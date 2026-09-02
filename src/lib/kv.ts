import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent, ClaimIntent, getGoalMilestones } from './types'
import { FUNNEL_EVENTS, type FunnelEvent } from './events'
import { verifyTxDetails } from './verify-tx'
import { normalizeAddress } from './profile-auth'
import { checkMilestone } from './milestones'
import { weekIndex, streakWeeks } from './time'
import { NEW_WALL_GRACE_MS } from './explore'

const PREFIX = 'tipwall:'

/** Unclaimed claim intents expire after this long, bounding KV growth. */
const CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** OG metadata is cached per-URL for this long to avoid refetching on every view. */
const OG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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

/** Index a pledge under its creator so the dashboard can list them. */
export async function addPledgeToken(handle: string, token: string): Promise<void> {
  await kv.sadd(`${PREFIX}pledges:${handle.toLowerCase()}`, token)
}

/** Surviving pledge records for a creator, newest first. */
export async function getPledges(handle: string): Promise<ClaimIntent[]> {
  const tokens = (await kv.smembers<string[]>(`${PREFIX}pledges:${handle.toLowerCase()}`)) || []
  if (!tokens.length) return []
  const claims = await Promise.all(tokens.map(t => getClaim(t)))
  return claims
    .filter((c): c is ClaimIntent => !!c && c.source === 'pledge')
    .sort((a, b) => b.createdAt - a.createdAt)
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
  await kv.incr(`${PREFIX}stats:${handle.toLowerCase()}:${event}:ref:${ref}`)
}

/** Top referrers for a funnel event, highest count first. */
export async function getTopRefs(handle: string, event: FunnelEvent, limit = 8): Promise<{ ref: string; count: number }[]> {
  const h = handle.toLowerCase()
  const keys = await kv.keys(`${PREFIX}stats:${h}:${event}:ref:*`)
  if (!keys.length) return []
  const values = await kv.mget<(number | null)[]>(...keys)
  return keys
    .map((k, i) => ({ ref: k.split(':ref:')[1] || 'other', count: Number(values?.[i] ?? 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getProfile(handle: string): Promise<CreatorProfile | null> {
  const raw = await kv.get<CreatorProfile>(`${PREFIX}profile:${handle.toLowerCase()}`)
  return raw ?? null
}

export async function setProfile(profile: CreatorProfile): Promise<void> {
  await kv.set(`${PREFIX}profile:${profile.handle.toLowerCase()}`, profile)
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

export async function getProfileByWallet(walletAddress: string): Promise<CreatorProfile | null> {
  const setHandles = await kv.smembers<string[]>(`${PREFIX}walletset:${normalizeAddress(walletAddress)}`)
  for (const h of setHandles || []) {
    const p = await getProfile(h)
    if (p) return p
  }
  const key = `${WALLET_INDEX_PREFIX}${normalizeAddress(walletAddress)}`
  const handles = (await kv.get<string[]>(key)) || []
  for (const h of handles) {
    const p = await getProfile(h)
    if (p) return p
  }
  return null
}

export async function addTip(handle: string, tip: Tip): Promise<void> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  // Use an atomic list push instead of read-modify-write so concurrent tips
  // to the same creator can't clobber each other (lost-update race).
  await kv.lpush(key, tip)
  await kv.ltrim(key, 0, 199)
}

/** Atomically reserve a transaction hash and append its tip record. */
export async function recordTipAtomically(handle: string, txHash: string, tip: Tip): Promise<boolean> {
  const globalTxKey = `${PREFIX}txseen:global`
  const txKey = `${PREFIX}txseen:${handle.toLowerCase()}`
  const verifiedTxKey = `${PREFIX}vtxseen:${handle.toLowerCase()}`
  const tipKey = `${PREFIX}tips:${handle.toLowerCase()}`
  const result = await kv.eval(
    `if redis.call('SADD', KEYS[1], ARGV[1]) == 1 then redis.call('SADD',KEYS[2],ARGV[1]); if ARGV[3]=='1' then redis.call('SADD',KEYS[3],ARGV[1]) end; redis.call('LPUSH', KEYS[4], ARGV[2]); redis.call('LTRIM', KEYS[4], 0, 199); return 1 else return 0 end`,
    [globalTxKey, txKey, verifiedTxKey, tipKey],
    [txHash, JSON.stringify(tip), tip.verified ? '1' : '0'],
  )
  return Number(result) === 1
}

// --- Lifetime aggregates ----------------------------------------------------
// The tip list is trimmed to the most recent 200 entries, so anything that must
// be correct for the lifetime of a wall (totals, milestones, replay protection)
// lives in persistent aggregates instead of being recomputed from the list.

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
  const tips = await getTips(handle)
  const hashes = [...new Set(tips.filter(t => t.verified && t.txHash).map(t => t.txHash))]
  for (const hash of hashes) await kv.sadd(key, hash)
  return Number((await kv.scard(key)) ?? 0) || 0
}

/**
 * Lifetime verified total in NIM, stored as an integer luna counter. Seeds the
 * counter from the (possibly trimmed) tip list the first time a legacy wall is
 * read, so pre-existing walls keep their totals.
 */
export async function getVerifiedTotalNim(handle: string): Promise<number> {
  const key = `${PREFIX}vtotal:${handle.toLowerCase()}`
  const raw = await kv.get<number>(key)
  if (raw != null) return Number(raw) / LUNA_PER_NIM
  const legacy = Math.round(verifiedTotal(await getTips(handle)) * LUNA_PER_NIM)
  // NX so two concurrent seeders can't double-write; re-read to converge.
  await kv.set(key, legacy, { nx: true })
  return Number((await kv.get<number>(key)) ?? legacy) / LUNA_PER_NIM
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
export function sanitizeTips(tips: Tip[]): Tip[] {
  return tips.map(t => (t.anonymous ? { ...t, senderAddress: '', senderName: undefined } : t))
}

/**
 * Owner-private fields must never reach public readers (wall page props,
 * public JSON API, share kit). The dashboard/edit owner flows read the raw
 * profile instead.
 */
export function stripSensitiveProfileFields(profile: CreatorProfile): CreatorProfile {
  const publicProfile = { ...profile }
  delete publicProfile.notifyTelegram
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

  // New profiles always enter the registry. KEYS remains only as a migration
  // fallback for older deployments or a registry read failure.
  let durableIndexAvailable = registryResult.status === 'fulfilled' && registered.length > 0
  if (!durableIndexAvailable) {
    try {
      const keys = await kv.keys(`${PREFIX}profile:*`)
      append(keys.map(key => key.slice(`${PREFIX}profile:`.length)))
      durableIndexAvailable = true
    } catch (error) {
      recordFailure(error)
    }
  }

  if (!durableIndexAvailable) {
    throw lastError instanceof Error ? lastError : new Error('Creator discovery is unavailable')
  }

  return handles
}

// --- Ecosystem aggregates (site-wide social proof) --------------------------
// Site-wide totals for the home page's "the network is real" strip. Reads the
// persistent lifetime counters (vtotal / vtxseen), never the 200-trimmed tip
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
  if (!handles?.length) {
    const keys = await kv.keys(`${PREFIX}profile:*`)
    handles = keys.map(k => k.slice(`${PREFIX}profile:`.length)).filter(Boolean)
    for (const handle of handles) await kv.sadd(`${PREFIX}profiles`, handle)
  }

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

  // Funnel counters: all-time totals plus every per-day key.
  try {
    const statKeys = await kv.keys(`${PREFIX}stats:${h}:*`)
    if (statKeys.length) await kv.del(...statKeys)
  } catch {
    // Best effort - orphaned counters carry no PII and reference nothing.
  }
}

export async function getTips(handle: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  return (await kv.lrange<Tip>(key, 0, -1)) || []
}

/**
 * Re-check tips that were recorded as unverified (indexer was lagging at submit
 * time). Upgrades ones that now confirm on-chain, and drops ones that resolve to
 * a mismatch (a fabricated txHash that never funded this creator). Returns the
 * up-to-date tip list. Safe to call on read; only rewrites KV when something
 * actually changed, and skips very recent tips so it can't race a fresh submit.
 */
export async function reverifyPendingTips(handle: string, walletAddress: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const tips = await getTips(handle)
  const now = Date.now()
  // Only tips old enough that a real one would be indexed by now, so we don't
  // fight the submit-time verification or clobber an in-flight lpush.
  const pending = tips.filter(t => !t.verified && now - t.timestamp > 20000)
  if (!pending.length) return tips

  const updates = new Map<string, { action: 'verify' | 'remove'; senderAddress?: string }>()
  for (const t of pending) {
    const res = await verifyTxDetails(t.txHash, walletAddress, Math.round(t.amountNIM * 100000), 1)
    if (res.result === 'verified') updates.set(t.id, { action: 'verify', senderAddress: res.senderAddress })
    else if (res.result === 'mismatch') updates.set(t.id, { action: 'remove' })
  }
  if (!updates.size) return tips

  // Update individual entries atomically so concurrent new tips are never deleted.
  const current = await getTips(handle)
  for (const t of current) {
    const update = updates.get(t.id)
    if (!update) continue
    await kv.eval(
      `local rows=redis.call('LRANGE',KEYS[1],0,-1); for i,row in ipairs(rows) do local ok,item=pcall(cjson.decode,row); if ok and item.id==ARGV[1] then if ARGV[2]=='remove' then redis.call('LREM',KEYS[1],1,row) else item.verified=true; if ARGV[3]~='' then item.senderAddress=ARGV[3] end; redis.call('LSET',KEYS[1],i-1,cjson.encode(item)) end; return 1 end end; return 0`,
      [key],
      [t.id, update.action, update.senderAddress || ''],
    )
  }
  const rebuilt = await getTips(handle)

  // Tips that just confirmed on-chain now count toward the lifetime total, and
  // may push the wall over a milestone the submit-time check couldn't award.
  // Milestones are goal-relative, so award against this creator's derived ladder.
  const goalTarget = (await getProfile(handle))?.goal?.targetNIM ?? 1000
  const milestones = getGoalMilestones(goalTarget)
  for (const t of current) {
    if (updates.get(t.id)?.action !== 'verify') continue
    // Multiple readers can reverify the same pending record concurrently. The
    // verified-tx set makes promotion and its lifetime aggregates idempotent.
    if (!await markVerifiedTxSeen(handle, t.txHash)) continue
    const prevTotal = await getVerifiedTotalNim(handle)
    const newTotal = await addVerifiedNim(handle, t.amountNIM)
    const event = checkMilestone(prevTotal, newTotal, t.anonymous ? 'Anonymous' : t.senderAddress, milestones)
    if (event) await addMilestone(handle, event)
    await trackEvent(handle, 'TIP_COMPLETED')
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
 * push can't be clobbered. Returns false when the tip id no longer exists
 * (e.g. trimmed past 200 entries).
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

/** Rolling window for the /explore leaderboard. */
export const LEADERBOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Verified NIM received by a creator within the trailing `windowMs`.
 *
 * Computed from the tip list rather than a stored counter: the list is the only
 * place tip timestamps live, and it is exact for any wall under the 200-entry
 * ltrim cap. A wall past that cap could under-report inside the window, which is
 * acceptable - this drives a "recent activity" ranking, not an audited total.
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
  // (Derived from the most recent 200 tips - a "recent supporters" view.)
  const tips = (await getTips(handle)).filter(t => t.verified && !t.anonymous)
  const supportersMap = new Map<string, Supporter>()
  const weeksByAddress = new Map<string, number[]>()

  tips.forEach(tip => {
    const existing = supportersMap.get(tip.senderAddress)
    if (existing) {
      existing.totalNIM += tip.amountNIM
      existing.tipCount += 1
      existing.firstTipAt = Math.min(existing.firstTipAt, tip.timestamp)
    } else {
      supportersMap.set(tip.senderAddress, {
        address: tip.senderAddress,
        totalNIM: tip.amountNIM,
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

  return Array.from(supportersMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
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
    console.warn('Failed to fetch OG metadata:', err)
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
