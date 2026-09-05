import { kv as remoteKv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent, ClaimIntent, getGoalMilestones } from './types'
import { FUNNEL_EVENTS, type FunnelEvent } from './events'
import { verifyTxDetails } from './verify-tx'
import { verifyUsdtTxDetails } from './verify-usdt'
import { normalizeAddress } from './profile-auth'
import { checkMilestone } from './milestones'
import { weekIndex, streakWeeks } from './time'
import { NEW_WALL_GRACE_MS } from './explore'
import { logError } from './logger'
import { sendTelegramTipNotification } from './telegram'
import { LocalKv } from './local-kv'

type TipWallRuntime = typeof globalThis & { __tipwallLocalKv?: LocalKv }
const runtime = globalThis as TipWallRuntime
const localKv = runtime.__tipwallLocalKv ?? (runtime.__tipwallLocalKv = new LocalKv())
const localFallbackEnabled = process.env.NODE_ENV === 'development'
let remoteKvUnavailable = false
let fallbackReported = false
type LocalKvMethod = (this: LocalKv, ...args: unknown[]) => unknown

function invokeLocalKv(method: PropertyKey, args: unknown[]): unknown {
  const localMethod = (localKv as unknown as Record<string, LocalKvMethod>)[String(method)]
  return localMethod.apply(localKv, args)
}

function isTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  if (message.includes('fetch failed') || message.includes('econnrefused') || message.includes('enetwork') || message.includes('etimedout') || message.includes('enetunreach')) return true
  const cause = (error as Error & { cause?: unknown }).cause
  return cause instanceof Error ? isTransportError(cause) : false
}

async function invokeKv(method: PropertyKey, remoteMethod: (...args: unknown[]) => unknown, args: unknown[]): Promise<unknown> {
  if (remoteKvUnavailable) {
    return invokeLocalKv(method, args)
  }

  try {
    return await remoteMethod(...args)
  } catch (error) {
    // A local dev server should remain useful when its sandbox/network cannot
    // reach Upstash. Authentication and command errors still surface; only
    // transport failures activate the in-memory store.
    if (!localFallbackEnabled || !isTransportError(error)) throw error
    remoteKvUnavailable = true
    if (!fallbackReported) {
      fallbackReported = true
      logError('kv_transport_unavailable_local_fallback', error)
    }
    return invokeLocalKv(method, args)
  }
}

/** Vercel KV in production, with a transport-only in-memory fallback in dev. */
export const kv = new Proxy(remoteKv, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args: unknown[]) => invokeKv(property, value.bind(target), args)
  },
}) as typeof remoteKv

const PREFIX = 'tipwall:'

/** Unclaimed claim intents expire after this long, bounding KV growth. */
const CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** OG metadata is cached per-URL for this long to avoid refetching on every view. */
const OG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** Pending chain lookups are bounded and exponentially spaced. */
const PENDING_REVERIFY_MAX_ATTEMPTS = 6
const PENDING_REVERIFY_MAX_AGE_MS = 24 * 60 * 60 * 1000
const PENDING_REVERIFY_DELAYS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

/**
 * Distributed fixed-window rate limit backed by KV, so the limit holds across
 * serverless instances (an in-process Map does not - each cold start resets it).
 * Returns true if the request is within `limit` for the current window.
 */
export async function checkRateLimit(id: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `${PREFIX}ratelimit:${id}`
  // Create the window atomically with its TTL (SET NX PX), so a failure between
  // INCR and EXPIRE can never leave a counter that lives - and blocks - forever.
  const created = await kv.set(key, 1, { nx: true, px: windowMs })
  if (created === 'OK') return 1 <= limit
  const count = await kv.incr(key)
  return count <= limit
}

/**
 * Reject hosts that resolve inside the deployment's own network so a
 * user-supplied URL can't be used for SSRF (cloud metadata, loopback, RFC1918).
 * String-based (won't stop DNS rebinding) but blocks the obvious vectors.
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true
  // IPv6 loopback / link-local / unique-local
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true
  // Cloud metadata endpoint
  if (h === '169.254.169.254') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

/**
 * Atomically consume a one-time authorization nonce (the signature itself).
 * Returns true if this signature has never been seen before (and reserves it
 * for `ttlMs`), or false if it was already used - i.e. a replay attempt.
 * Relies on Redis SET NX PX so the check-and-set is a single atomic op.
 */
export async function consumeAuthNonce(signature: string, ttlMs: number): Promise<boolean> {
  const key = `${PREFIX}authnonce:${signature}`
  const res = await kv.set(key, 1, { nx: true, px: ttlMs })
  return res === 'OK'
}

// --- Claim intents (Phase 2: cross-device tip recovery, non-custodial) -----

export async function createClaim(claim: ClaimIntent): Promise<void> {
  await kv.set(`${PREFIX}claim:${claim.token}`, claim, { px: CLAIM_TTL_MS })
}

export async function getClaim(token: string): Promise<ClaimIntent | null> {
  return (await kv.get<ClaimIntent>(`${PREFIX}claim:${token}`)) ?? null
}

/** Mark a claim as fulfilled once an on-chain tip completes it. Idempotent. */
export async function markClaimClaimed(token: string, txHash?: string): Promise<boolean> {
  const result = await kv.eval(
    `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local claim=cjson.decode(raw); if claim.claimed then return 0 end; claim.claimed=true; claim.claimedAt=tonumber(ARGV[1]); if ARGV[2]~='' then claim.claimTxHash=ARGV[2] end; redis.call('SET',KEYS[1],cjson.encode(claim),'PX',ARGV[3]); return 1`,
    [`${PREFIX}claim:${token}`],
    [String(Date.now()), txHash || '', String(CLAIM_TTL_MS)],
  )
  return Number(result) === 1
}

// --- Conversion funnel counters (Phase 3) ----------------------------------

/**
 * Record a funnel event. Stores an all-time total plus a per-day count for time
 * series. When `dedupKey` (an anonymous client id) is provided the event is
 * counted at most once per key per day - used for view-type events so bots /
 * refreshes don't inflate the funnel.
 */
export async function trackEvent(handle: string, event: FunnelEvent, dedupKey?: string): Promise<void> {
  const h = handle.toLowerCase()
  const day = new Date().toISOString().slice(0, 10)
  if (dedupKey) {
    const seen = await kv.set(`${PREFIX}statseen:${h}:${event}:${dedupKey}:${day}`, 1, { nx: true, px: 36 * 60 * 60 * 1000 })
    if (seen !== 'OK') return
  }
  await kv.incr(`${PREFIX}stats:${h}:${event}:total`)
  await kv.incr(`${PREFIX}stats:${h}:${event}:${day}`)
}

/** All-time totals for every funnel event. */
export async function getStats(handle: string): Promise<Record<FunnelEvent, number>> {
  const h = handle.toLowerCase()
  const keys = FUNNEL_EVENTS.map((e) => `${PREFIX}stats:${h}:${e}:total`)
  const values = await kv.mget<(number | null)[]>(...keys)
  const out = {} as Record<FunnelEvent, number>
  FUNNEL_EVENTS.forEach((e, i) => { out[e] = Number(values?.[i] ?? 0) })
  return out
}

/** Increment a per-referrer counter for a funnel event. */
export async function trackRef(handle: string, event: FunnelEvent, ref: string): Promise<void> {
  await kv.hincrby(`${PREFIX}stats:${handle.toLowerCase()}:${event}:refs`, ref || 'other', 1)
}

/** Top referrers for a funnel event, highest count first. */
export async function getTopRefs(handle: string, event: FunnelEvent, limit = 8): Promise<{ ref: string; count: number }[]> {
  const h = handle.toLowerCase()
  const values = await kv.hgetall<Record<string, number | string>>(`${PREFIX}stats:${h}:${event}:refs`)
  if (!values) return []
  return Object.entries(values)
    .map(([ref, count]) => ({ ref: ref || 'other', count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getProfile(handle: string): Promise<CreatorProfile | null> {
  const raw = await kv.get<CreatorProfile>(`${PREFIX}profile:${handle.toLowerCase()}`)
  return raw ?? null
}

/** Durable profile index used by scheduled maintenance and discovery. */
export async function getRegisteredHandles(): Promise<string[]> {
  const handles = await kv.smembers<string[]>(`${PREFIX}profiles`)
  return (handles || []).map(handle => String(handle).toLowerCase()).filter(Boolean)
}

export async function setProfile(profile: CreatorProfile): Promise<void> {
  await kv.set(`${PREFIX}profile:${profile.handle.toLowerCase()}`, profile)
  // Keep the durable registry populated for legacy profiles touched by an edit.
  await kv.sadd(`${PREFIX}profiles`, profile.handle.toLowerCase())
}

export async function setProfileNX(profile: CreatorProfile): Promise<boolean> {
  const key = `${PREFIX}profile:${profile.handle.toLowerCase()}`
  const res = await kv.set(key, profile, { nx: true })
  if (res === 'OK') {
    await kv.sadd(`${PREFIX}profiles`, profile.handle.toLowerCase())
    return true
  }
  return false
}

const WALLET_INDEX_PREFIX = `${PREFIX}wallet:`

export async function addProfileToWalletIndex(profile: CreatorProfile): Promise<void> {
  await kv.sadd(`${PREFIX}walletset:${normalizeAddress(profile.walletAddress)}`, profile.handle.toLowerCase())
  const key = `${WALLET_INDEX_PREFIX}${normalizeAddress(profile.walletAddress)}`
  const existing = (await kv.get<string[]>(key)) || []
  if (!existing.includes(profile.handle.toLowerCase())) {
    existing.push(profile.handle.toLowerCase())
    await kv.set(key, existing)
  }
}

/** Return every profile owned by a wallet, in stable creation order. */
export async function getProfilesByWallet(walletAddress: string): Promise<CreatorProfile[]> {
  const normalized = normalizeAddress(walletAddress)
  const handles = new Set<string>()
  for (const h of (await kv.smembers<string[]>(`${PREFIX}walletset:${normalized}`)) || []) handles.add(String(h).toLowerCase())
  for (const h of (await kv.get<string[]>(`${WALLET_INDEX_PREFIX}${normalized}`)) || []) handles.add(String(h).toLowerCase())
  const profiles = (await Promise.all([...handles].map(getProfile))).filter((p): p is CreatorProfile => !!p)
  return profiles.sort((a, b) => a.createdAt - b.createdAt || a.handle.localeCompare(b.handle))
}

/** Atomically move a profile's owner binding to a new wallet index. */
export async function transferProfileOwnership(profile: CreatorProfile, newWalletAddress: string, newOwnerPublicKey: string): Promise<CreatorProfile> {
  const oldAddress = normalizeAddress(profile.walletAddress)
  const updated: CreatorProfile = {
    ...profile,
    walletAddress: normalizeAddress(newWalletAddress),
    ownerPublicKey: newOwnerPublicKey,
    // Delegation is consumed by a successful rotation. The new owner must
    // explicitly designate their own recovery wallet afterward.
    recoveryWalletAddress: undefined,
    updatedAt: Date.now(),
  }
  await setProfile(updated)
  await addProfileToWalletIndex(updated)
  const oldWalletKey = `${WALLET_INDEX_PREFIX}${oldAddress}`
  const oldHandles = (await kv.get<string[]>(oldWalletKey)) || []
  const remaining = oldHandles.filter(h => h !== profile.handle.toLowerCase())
  if (remaining.length) await kv.set(oldWalletKey, remaining)
  else await kv.del(oldWalletKey)
  await kv.srem(`${PREFIX}walletset:${oldAddress}`, profile.handle.toLowerCase())
  return updated
}

export async function addTip(handle: string, tip: Tip): Promise<void> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  // Use an atomic list push instead of read-modify-write so concurrent tips
  // to the same creator can't clobber each other (lost-update race). This is
  // append-only: a wall promises that its supporters' messages remain there.
  await kv.lpush(key, tip)
}

/** Atomically reserve a transaction hash and append its tip record. */
export async function recordTipAtomically(handle: string, txHash: string, tip: Tip): Promise<boolean> {
  const globalTxKey = `${PREFIX}txseen:global`
  const txKey = `${PREFIX}txseen:${handle.toLowerCase()}`
  const verifiedTxKey = `${PREFIX}vtxseen:${handle.toLowerCase()}`
  const tipKey = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `if redis.call('SADD', KEYS[1], ARGV[1]) == 1 then redis.call('SADD',KEYS[2],ARGV[1]); if ARGV[3]=='1' then redis.call('SADD',KEYS[3],ARGV[1]) end; redis.call('LPUSH', KEYS[4], ARGV[2]); return 1 else return 0 end`,
    [globalTxKey, txKey, verifiedTxKey, tipKey],
    [txHash, JSON.stringify(tip), tip.verified ? '1' : '0'],
  )
  return Number(result) === 1
}

// --- Lifetime aggregates ----------------------------------------------------
// Tip records are append-only, while these counters keep lifetime reads cheap
// and preserve totals even when a legacy deployment has already trimmed rows.

const LUNA_PER_NIM = 100000

/**
 * Atomically record a txHash for a creator. Returns true the first time a hash
 * is seen and false on any repeat - lifetime replay protection that, unlike the
 * tip list, never forgets old hashes.
 */
export async function markTxSeen(handle: string, txHash: string): Promise<boolean> {
  const added = await kv.sadd(`${PREFIX}txseen:${handle.toLowerCase()}`, txHash)
  return added === 1
}

/**
 * Record a transaction once it is confirmed on-chain. This is separate from
 * txseen, which is replay protection and therefore also contains pending or
 * rejected submissions.
 */
export async function markVerifiedTxSeen(handle: string, txHash: string): Promise<boolean> {
  const added = await kv.sadd(`${PREFIX}vtxseen:${handle.toLowerCase()}`, txHash)
  return added === 1
}

/** Lifetime count of distinct verified tips. Backfills the current list for
 * walls created before the verified-tx counter existed. */
export async function getVerifiedTipCount(handle: string): Promise<number> {
  const key = `${PREFIX}vtxseen:${handle.toLowerCase()}`
  const stored = Number((await kv.scard(key)) ?? 0) || 0
  if (stored > 0) return stored
  // Pure fallback for walls created before vtxseen existed. Do not backfill
  // during a read; the scheduled reconciliation/write path owns migrations.
  const tips = await getTips(handle)
  return new Set(tips.filter(t => t.verified && t.txHash).map(t => t.txHash)).size
}

/**
 * Lifetime verified total in NIM, stored as an integer luna counter. Legacy
 * walls fall back to their retained records without writing during a read.
 */
export async function getVerifiedTotalNim(handle: string): Promise<number> {
  const key = `${PREFIX}vtotal:${handle.toLowerCase()}`
  const raw = await kv.get<number>(key)
  if (raw != null) return Number(raw) / LUNA_PER_NIM
  return verifiedTotal(await getTips(handle))
}

/** Seed a legacy lifetime total from a mutation path, never from a GET. */
export async function initializeVerifiedTotal(handle: string, totalNIM: number): Promise<void> {
  await kv.set(
    `${PREFIX}vtotal:${handle.toLowerCase()}`,
    Math.round(totalNIM * LUNA_PER_NIM),
    { nx: true },
  )
}

/** Add a verified tip amount to the lifetime counter; returns the new total NIM. */
export async function addVerifiedNim(handle: string, amountNIM: number): Promise<number> {
  const key = `${PREFIX}vtotal:${handle.toLowerCase()}`
  const luna = await kv.incrby(key, Math.round(amountNIM * LUNA_PER_NIM))
  return luna / LUNA_PER_NIM
}

/**
 * Strip identifying data from anonymous tips before they leave the server.
 * The sender address is stored (needed for verification) but must never be
 * exposed through any API response when the tipper chose to stay anonymous.
 */
export function sanitizeTips(tips: Tip[], options: { includeHidden?: boolean } = {}): Tip[] {
  return tips.filter(t => options.includeHidden || !t.hiddenAt).map(t => {
    const publicTip = { ...t }
    // Verification scheduling is an internal maintenance detail, not wall
    // content that should be exposed to visitors or exported to creators.
    delete publicTip.verificationAttempts
    delete publicTip.nextVerificationAt
    delete publicTip.telegramNotificationClaimedAt
    delete publicTip.telegramNotifiedAt
    if (!options.includeHidden) delete publicTip.hiddenAt
    if (publicTip.anonymous) {
      publicTip.senderAddress = ''
      publicTip.senderName = undefined
    }
    return publicTip
  })
}

/**
 * Owner-private fields must never reach public readers (wall page props,
 * public JSON API, share kit). The dashboard/edit owner flows read the raw
 * profile instead.
 */
export function stripSensitiveProfileFields(profile: CreatorProfile): CreatorProfile {
  const publicProfile = { ...profile }
  delete publicProfile.notifyTelegram
  delete publicProfile.recoveryWalletAddress
  return publicProfile
}

// --- Discovery: recently-active walls ---------------------------------------
// A sorted set scored by last-activity time feeds the /explore page. Best
// effort on purpose: discovery must never break profile creation or tipping.

const ACTIVITY_KEY = `${PREFIX}active`

/** Bump a wall to the top of the recently-active index. */
export async function touchActivity(handle: string): Promise<void> {
  try {
    await kv.zadd(ACTIVITY_KEY, { score: Date.now(), member: handle.toLowerCase() })
  } catch {
    // Discovery index is non-critical.
  }
}

/** Most recently active wall handles, newest first. */
export async function getActiveHandles(limit = 24): Promise<string[]> {
  try {
    const res = await kv.zrange<string[]>(ACTIVITY_KEY, 0, limit - 1, { rev: true })
    return res || []
  } catch {
    return []
  }
}

/**
 * Discovery candidates ordered by recent activity, then completed from every
 * durable profile index. The limit only caps the recent-activity read; durable
 * candidates remain available for callers to validate before applying their
 * display limit. An outage must not look like a genuinely empty community.
 */
export async function getDiscoveryHandles(recentLimit = 24): Promise<string[]> {
  const handles: string[] = []
  const seen = new Set<string>()
  let lastError: unknown = null

  const append = (values: unknown[]) => {
    for (const value of values) {
      const handle = String(value || '').trim().toLowerCase()
      if (!handle || seen.has(handle)) continue
      seen.add(handle)
      handles.push(handle)
    }
  }

  const recordFailure = (error: unknown) => {
    lastError = error
  }

  const [activityResult, registryResult] = await Promise.allSettled([
    kv.zrange<string[]>(ACTIVITY_KEY, 0, Math.max(1, recentLimit) - 1, { rev: true }),
    kv.smembers<string[]>(`${PREFIX}profiles`),
  ])

  if (activityResult.status === 'fulfilled') append(activityResult.value || [])
  else recordFailure(activityResult.reason)

  const registered = registryResult.status === 'fulfilled' ? registryResult.value || [] : []
  if (registryResult.status === 'fulfilled') append(registered)
  else recordFailure(registryResult.reason)

  // The registry is the canonical index. Do not fall back to KEYS in a
  // request path: managed Redis treats a keyspace scan as an O(N) operation.
  if (registryResult.status !== 'fulfilled') {
    throw lastError instanceof Error ? lastError : new Error('Creator discovery is unavailable')
  }

  return handles
}

// --- Ecosystem aggregates (site-wide social proof) --------------------------
// Site-wide totals for the home page's "the network is real" strip. Reads the
// persistent lifetime counters (vtotal / vtxseen), never a reconstructed tip
// list, so figures stay correct for high-volume walls. Best effort: any read
// failure yields zeros rather than throwing - this only powers a marketing strip.

export type EcosystemStats = {
  walls: number
  tippedCreators: number
  totalNIM: number
  totalTips: number
  /** Verified tips per reason, powering the home page's live signal card. */
  reasonCounts: Record<string, number>
}

export async function getEcosystemStats(): Promise<EcosystemStats> {
  let handles = await kv.smembers<string[]>(`${PREFIX}profiles`)
  handles = handles || []

  const now = Date.now()

  // Per-wall reads run in parallel; each wall contributes its lifetime luna
  // total, its distinct verified-txHash count, and its creation time. A flaky
  // read degrades that wall to zeros instead of sinking the whole call.
  const perWall = await Promise.all(
    handles.map(async (h) => {
      try {
        const [luna, txCount, profile, tips] = await Promise.all([
          kv.get<number>(`${PREFIX}vtotal:${h}`).then(v => Number(v ?? 0) || 0),
          getVerifiedTipCount(h),
          kv.get<CreatorProfile>(`${PREFIX}profile:${h.toLowerCase()}`),
          kv.lrange<Tip>(`${PREFIX}tips:${h.toLowerCase()}`, 0, -1).then(t => t || []),
        ])
        return { luna, txCount, createdAt: Number(profile?.createdAt ?? 0), tips }
      } catch {
        return { luna: 0, txCount: 0, createdAt: 0, tips: [] as Tip[] }
      }
    }),
  )

  let walls = 0
  let tippedCreators = 0
  let totalLuna = 0
  let totalTips = 0
  const reasonCounts: Record<string, number> = {}

  for (const { luna, txCount, createdAt, tips } of perWall) {
    totalLuna += luna
    totalTips += txCount
    const tipped = luna > 0 || txCount > 0
    if (tipped) tippedCreators++
    // Count only walls Explore would list: tipped at least once, or still
    // inside the new-wall grace window. Keeps this figure honest next to the
    // directory instead of counting every registered handle.
    if (tipped || (createdAt > 0 && now - createdAt < NEW_WALL_GRACE_MS)) walls++
    for (const tip of tips) {
      if (tip.verified && tip.reason) reasonCounts[tip.reason] = (reasonCounts[tip.reason] ?? 0) + 1
    }
  }

  return {
    walls,
    tippedCreators,
    totalNIM: totalLuna / LUNA_PER_NIM,
    totalTips,
    reasonCounts,
  }
}

// --- Wall deletion -----------------------------------------------------------

const TOMBSTONE_PREFIX = `${PREFIX}tombstone:`

/**
 * A deleted wall's handle stays burned so nobody can re-register it and
 * impersonate the previous owner to an audience that still holds old links
 * (READMEs, bios, videos). One tiny permanent record per deleted wall.
 */
export async function isHandleTombstoned(handle: string): Promise<boolean> {
  return (await kv.get(`${TOMBSTONE_PREFIX}${handle.toLowerCase()}`)) != null
}

/**
 * Erase every record a wall owns: profile, tips, replay set, lifetime total,
 * milestones, funnel counters, wallet-index entry, and its /explore listing.
 * The tombstone is written FIRST so the handle is already burned even if a
 * later sweep step fails mid-way (a retry then finishes the cleanup).
 */
export async function deleteProfileData(profile: CreatorProfile): Promise<void> {
  const h = profile.handle.toLowerCase()

  await kv.set(`${TOMBSTONE_PREFIX}${h}`, { deletedAt: Date.now() })

  // Wallet index: drop this handle, keep any others owned by the same wallet.
  const walletKey = `${WALLET_INDEX_PREFIX}${normalizeAddress(profile.walletAddress)}`
  await kv.srem(`${PREFIX}walletset:${normalizeAddress(profile.walletAddress)}`, h)
  await kv.srem(`${PREFIX}profiles`, h)
  const handles = (await kv.get<string[]>(walletKey)) || []
  const remaining = handles.filter(x => x !== h)
  if (remaining.length) {
    await kv.set(walletKey, remaining)
  } else {
    await kv.del(walletKey)
  }

  try {
    await kv.zrem(ACTIVITY_KEY, h)
  } catch {
    // Discovery index is non-critical.
  }

  await kv.del(
    `${PREFIX}profile:${h}`,
    `${PREFIX}tips:${h}`,
    `${PREFIX}txseen:${h}`,
    `${PREFIX}vtxseen:${h}`,
    `${PREFIX}vtotal:${h}`,
    `${PREFIX}milestones:${h}`,
  )

  // Delete the bounded set of durable aggregate keys. Per-day legacy counters
  // are intentionally left untouched; wildcard key scans are not safe in a
  // production request path and those counters contain no wall content.
  const statKeys = FUNNEL_EVENTS.flatMap(event => [
    `${PREFIX}stats:${h}:${event}:total`,
    `${PREFIX}stats:${h}:${event}:refs`,
  ])
  await kv.del(...statKeys)
}

export async function getTips(handle: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  return (await kv.lrange<Tip>(key, 0, -1)) || []
}

/**
 * Re-check tips that were recorded as unverified (indexer was lagging at submit
 * time). Upgrades ones that now confirm on-chain, drops mismatches, and removes
 * permanently unresolvable records after a bounded, backoff-spaced retry
 * schedule. Returns the up-to-date tip list. This is a maintenance mutation,
 * not a read helper; callers should invoke it from the scheduled worker. It
 * skips very recent tips so it can't race a fresh submit.
 */
export async function reverifyPendingTips(handle: string, walletAddress: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const tips = await getTips(handle)
  const profile = await getProfile(handle)
  const now = Date.now()
  // Only tips old enough that a real one would be indexed by now, so we don't
  // fight the submit-time verification or clobber an in-flight lpush.
  const pending = tips.filter(t =>
    !t.verified &&
    now - t.timestamp > 20000 &&
    (!t.nextVerificationAt || t.nextVerificationAt <= now),
  )
  if (!pending.length) return tips

  // Legacy walls may not have a persistent aggregate yet. Initialize it before
  // promoting any pending record so the promotion cannot seed its own amount
  // and then count it a second time.
  const lifetimeBefore = await getVerifiedTotalNim(handle)
  await initializeVerifiedTotal(handle, lifetimeBefore)

  const updates = new Map<string, {
    action: 'verify' | 'remove' | 'retry'
    senderAddress?: string
    nextAttemptAt?: number
  }>()
  for (const t of pending) {
    const res = t.asset === 'USDT'
      ? await verifyUsdtTxDetails(t.txHash, profile?.usdtPolygonAddress || '', t.amountUSDT || 0, 1)
      : await verifyTxDetails(t.txHash, walletAddress, Math.round(t.amountNIM * 100000), 1)
    if (res.result === 'verified') updates.set(t.id, { action: 'verify', senderAddress: res.senderAddress })
    else if (res.result === 'mismatch') updates.set(t.id, { action: 'remove' })
    else if (now - t.timestamp >= PENDING_REVERIFY_MAX_AGE_MS) updates.set(t.id, { action: 'remove' })
    else updates.set(t.id, {
      action: 'retry',
      nextAttemptAt: now + PENDING_REVERIFY_DELAYS_MS[Math.min(t.verificationAttempts || 0, PENDING_REVERIFY_DELAYS_MS.length - 1)],
    })
  }

  // Update individual entries atomically so concurrent new tips are never deleted.
  const current = await getTips(handle)
  for (const t of current) {
    const update = updates.get(t.id)
    if (!update) continue
    await kv.eval(
      `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then if ARGV[2]=='remove' then redis.call('LREM',KEYS[1],1,row) elseif ARGV[2]=='retry' then local attempts=tonumber(item.verificationAttempts or 0)+1; if attempts>=tonumber(ARGV[5]) then redis.call('LREM',KEYS[1],1,row) else item.verificationAttempts=attempts; item.nextVerificationAt=tonumber(ARGV[4]); redis.call('LSET',KEYS[1],i-1,cjson.encode(item)) end else item.verified=true; item.verificationAttempts=nil; item.nextVerificationAt=nil; if ARGV[3]~='' then item.senderAddress=ARGV[3] end; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)) end; return 1 end end; return 0`,
      [key],
      [t.id, update.action, update.senderAddress || '', String(update.nextAttemptAt || 0), String(PENDING_REVERIFY_MAX_ATTEMPTS)],
    )
  }
  const rebuilt = await getTips(handle)

  // Tips that just confirmed on-chain now count toward the lifetime total, and
  // may push the wall over a milestone the submit-time check couldn't award.
  // Milestones are goal-relative, so award against this creator's derived ladder.
  const goalTarget = profile?.goal?.targetNIM ?? 1000
  const milestones = getGoalMilestones(goalTarget)
  for (const t of current) {
    if (updates.get(t.id)?.action !== 'verify') continue
    // Multiple readers can reverify the same pending record concurrently. The
    // verified-tx set makes promotion and its lifetime aggregates idempotent.
    if (await markVerifiedTxSeen(handle, t.txHash)) {
      const prevTotal = await getVerifiedTotalNim(handle)
      const newTotal = t.asset === 'USDT' ? await getVerifiedTotalNim(handle) : await addVerifiedNim(handle, t.amountNIM)
      if (t.asset !== 'USDT') {
        const event = checkMilestone(prevTotal, newTotal, t.anonymous ? 'Anonymous' : t.senderAddress, milestones)
        if (event) await addMilestone(handle, event)
      }
      await trackEvent(handle, 'TIP_COMPLETED')
    }
    if (profile?.notifyTelegram) {
      const claimedAt = Date.now()
      try {
        if (await claimTipTelegramNotification(handle, t.id, claimedAt)) {
          const promotedTip = { ...t, verified: true, senderAddress: updates.get(t.id)?.senderAddress || t.senderAddress }
          const sent = await sendTelegramTipNotification(profile, promotedTip)
          if (sent) await markTipTelegramNotified(handle, t.id)
          else await releaseTipTelegramNotification(handle, t.id, claimedAt)
        }
      } catch (error) {
        await releaseTipTelegramNotification(handle, t.id, claimedAt).catch(() => {})
        logError('telegram_notification_failed', error, { handle })
      }
    }
  }
  return rebuilt
}

/** Sum of NIM from verified tips only - unverified/pending tips don't count so a
 *  fabricated txHash can't inflate headline totals until it confirms on-chain. */
export function verifiedTotal(tips: Tip[]): number {
  return tips.reduce((sum, t) => sum + (t.verified ? t.amountNIM : 0), 0)
}

/**
 * Attach (or replace) the creator's thank-you reply on a single tip record.
 * Same atomic LSET-by-id pattern as reverifyPendingTips so a concurrent tip
 * push can't be clobbered. Returns false when the tip id no longer exists.
 */
export async function setTipReply(handle: string, tipId: string, reply: { message: string; at: number }): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then item.reply=cjson.decode(ARGV[2]); redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, JSON.stringify(reply)],
  )
  return Number(result) === 1
}

/** Hide or restore one tip without touching its verified financial record. */
export async function setTipHidden(handle: string, tipId: string, hidden: boolean): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then if item.deletedAt and ARGV[2]~='1' then return -1 end; if ARGV[2]=='1' then item.hiddenAt=tonumber(ARGV[3]) else item.hiddenAt=nil end; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, hidden ? '1' : '0', String(Date.now())],
  )
  return Number(result) === 1
}

/** Claim a Telegram notification slot once, with a short expiry for crashed sends. */
export async function claimTipTelegramNotification(handle: string, tipId: string, now = Date.now(), lockMs = 5 * 60 * 1000): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then if item.telegramNotifiedAt then return 0 end; local claimed=tonumber(item.telegramNotificationClaimedAt or 0); local now=tonumber(ARGV[2]); if claimed>0 and now-claimed<tonumber(ARGV[3]) then return 0 end; item.telegramNotificationClaimedAt=now; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, String(now), String(lockMs)],
  )
  return Number(result) === 1
}

/** Mark a successfully accepted Telegram alert and clear its in-flight claim. */
export async function markTipTelegramNotified(handle: string, tipId: string, notifiedAt = Date.now()): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then item.telegramNotifiedAt=tonumber(ARGV[2]); item.telegramNotificationClaimedAt=nil; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, String(notifiedAt)],
  )
  return Number(result) === 1
}

/** Release a failed notification claim so a later cron run can retry it. */
export async function releaseTipTelegramNotification(handle: string, tipId: string, claimedAt: number): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] and tonumber(item.telegramNotificationClaimedAt or 0)==tonumber(ARGV[2]) then item.telegramNotificationClaimedAt=nil; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, String(claimedAt)],
  )
  return Number(result) === 1
}

/** Permanently remove supporter-authored public content while retaining the
 * verified payment record for accounting, replay protection, and export. */
export async function deleteTip(handle: string, tipId: string): Promise<boolean> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then item.message=nil; item.senderName=nil; item.reply=nil; item.anonymous=true; item.hiddenAt=tonumber(ARGV[2]); item.deletedAt=tonumber(ARGV[2]); redis.call('LSET',KEYS[1],i-1,cjson.encode(item)); return 1 end end; return 0`,
    [key],
    [tipId, String(Date.now())],
  )
  return Number(result) === 1
}

/** Rolling window for the /explore leaderboard. */
export const LEADERBOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Verified NIM received by a creator within the trailing `windowMs`.
 *
 * Computed from the append-only tip list rather than a stored counter: the list
 * is the only place tip timestamps live, so this remains exact for every wall.
 * This drives a "recent activity" ranking, not an audited lifetime total.
 * Lifetime figures must still come from getVerifiedTotalNim().
 */
export async function getRecentVerifiedNim(
  handle: string,
  windowMs: number = LEADERBOARD_WINDOW_MS,
  now: number = Date.now(),
): Promise<number> {
  const tips = await getTips(handle)
  const cutoff = now - windowMs
  return tips.reduce(
    (sum, t) => (t.verified && t.timestamp >= cutoff ? sum + (t.amountNIM || 0) : sum),
    0,
  )
}

export async function getSupporters(handle: string): Promise<Supporter[]> {
  // Derive supporters from verified, NON-anonymous tips only: pending/forged
  // tips don't appear until they confirm, and an anonymous tipper's address
  // must never surface on the supporters wall or the top-supporter card.
  // Derived from every retained tip so supporter totals and streaks remain
  // durable as a wall grows.
  const tips = (await getTips(handle)).filter(t => t.verified && !t.hiddenAt && !t.anonymous)
  const supportersMap = new Map<string, Supporter>()
  const weeksByAddress = new Map<string, number[]>()

  tips.forEach(tip => {
    const existing = supportersMap.get(tip.senderAddress)
    if (existing) {
      existing.totalNIM += tip.amountNIM
      if (tip.asset === 'USDT') existing.totalUSDT = (existing.totalUSDT || 0) + (tip.amountUSDT || 0)
      existing.tipCount += 1
      existing.firstTipAt = Math.min(existing.firstTipAt, tip.timestamp)
    } else {
      supportersMap.set(tip.senderAddress, {
        address: tip.senderAddress,
        totalNIM: tip.amountNIM,
        ...(tip.asset === 'USDT' ? { totalUSDT: tip.amountUSDT || 0 } : {}),
        tipCount: 1,
        firstTipAt: tip.timestamp,
      })
      weeksByAddress.set(tip.senderAddress, [])
    }
    weeksByAddress.get(tip.senderAddress)!.push(weekIndex(tip.timestamp))
  })

  // Tips are stored newest-first: the first tip carrying a senderName per
  // address is the supporter's latest self-reported name.
  for (const tip of tips) {
    if (!tip.senderName) continue
    const s = supportersMap.get(tip.senderAddress)
    if (s && !s.name) s.name = tip.senderName
  }

  for (const s of supportersMap.values()) {
    s.streakWeeks = streakWeeks(weeksByAddress.get(s.address) || [])
  }

  return Array.from(supportersMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || (b.totalUSDT || 0) - (a.totalUSDT || 0) || a.firstTipAt - b.firstTipAt)
}

export async function getMilestones(handle: string): Promise<MilestoneEvent[]> {
  const key = `${PREFIX}milestones:${handle.toLowerCase()}`
  return (await kv.get<MilestoneEvent[]>(key)) || []
}

export async function addMilestone(handle: string, event: MilestoneEvent): Promise<boolean> {
  const result = await kv.eval(
    `local raw=redis.call('GET',KEYS[1]); local rows={}; if raw then rows=cjson.decode(raw) end; local incoming=cjson.decode(ARGV[1]); for _,row in ipairs(rows) do if row.threshold==incoming.threshold then return 0 end end; table.insert(rows,incoming); table.sort(rows,function(a,b) return a.threshold<b.threshold end); redis.call('SET',KEYS[1],cjson.encode(rows)); return 1`,
    [`${PREFIX}milestones:${handle.toLowerCase()}`],
    [JSON.stringify(event)],
  )
  return Number(result) === 1
}

export async function getOgMetadata(url: string): Promise<OGMetadata | null> {
  try {
    // Validate URL format + block SSRF: only public http(s) targets. The URL is
    // user-controlled (profile contentUrl), so refuse internal/loopback/metadata
    // hosts to stop the server being used to probe its own network.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (isPrivateHost(parsed.hostname)) return null

    // Serve from a per-URL cache so we don't refetch the target on every card
    // render (ContentPreviewCard mounts on each wall view).
    const cacheKey = `${PREFIX}og:${parsed.href}`
    const cached = await kv.get<OGMetadata>(cacheKey)
    if (cached) return cached.neg ? null : cached

    // Failed upstream fetches are cached briefly too, so a dead contentUrl
    // fails fast instead of hanging every wall view until the abort timer.
    const cacheFailure = () => kv.set(cacheKey, { neg: true } as OGMetadata, { px: 5 * 60 * 1000 }).catch(() => {})

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual',
    })
    clearTimeout(timeout)

    if (resp.status >= 300 && resp.status < 400) return null
    if (!resp.ok) {
      await cacheFailure()
      return null
    }

    const contentLength = Number(resp.headers.get('content-length') || 0)
    if (contentLength > 512_000) return null

    const html = await resp.text()
    if (!html || html.length > 512_000) return null

    const getMeta = (prop: string) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
      const m = html.match(re)
      return m ? m[1] : null
    }

    const meta: OGMetadata = {
      title: getMeta('og:title') || getMeta('title') || 'Untitled',
      description: getMeta('og:description') || getMeta('description') || '',
      image: getMeta('og:image') || '',
      url: getMeta('og:url') || url,
      siteName: getMeta('og:site_name') || '',
    }
    await kv.set(cacheKey, meta, { px: OG_CACHE_TTL_MS })
    return meta
  } catch (err) {
    // Log error for debugging but don't break the flow
    logError('og_metadata_fetch_failed', err)
    await kv.set(`${PREFIX}og:${url}`, { neg: true } as OGMetadata, { px: 5 * 60 * 1000 }).catch(() => {})
    return null
  }
}

export async function cacheOg(handle: string, meta: OGMetadata): Promise<void> {
  const profile = await getProfile(handle)
  if (!profile) return
  profile.ogCache = meta
  profile.ogCachedAt = Date.now()
  await setProfile(profile)
}
