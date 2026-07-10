import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent, ClaimIntent } from './types'
import { FUNNEL_EVENTS, type FunnelEvent } from './events'
import { verifyTx } from './verify-tx'
import { normalizeAddress } from './profile-auth'
import { checkMilestone } from './milestones'

const PREFIX = 'tipwall:'

/** Unclaimed claim intents expire after this long, bounding KV growth. */
const CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** OG metadata is cached per-URL for this long to avoid refetching on every view. */
const OG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Distributed fixed-window rate limit backed by KV, so the limit holds across
 * serverless instances (an in-process Map does not — each cold start resets it).
 * Returns true if the request is within `limit` for the current window.
 */
export async function checkRateLimit(id: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `${PREFIX}ratelimit:${id}`
  // Create the window atomically with its TTL (SET NX PX), so a failure between
  // INCR and EXPIRE can never leave a counter that lives — and blocks — forever.
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
 * for `ttlMs`), or false if it was already used — i.e. a replay attempt.
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
  const claim = await getClaim(token)
  if (!claim || claim.claimed) return false
  claim.claimed = true
  claim.claimedAt = Date.now()
  if (txHash) claim.claimTxHash = txHash
  await kv.set(`${PREFIX}claim:${claim.token}`, claim, { px: CLAIM_TTL_MS })
  return true
}

// --- Conversion funnel counters (Phase 3) ----------------------------------

/**
 * Record a funnel event. Stores an all-time total plus a per-day count for time
 * series. When `dedupKey` (an anonymous client id) is provided the event is
 * counted at most once per key per day — used for view-type events so bots /
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
  return res === 'OK'
}

const WALLET_INDEX_PREFIX = `${PREFIX}wallet:`

export async function addProfileToWalletIndex(profile: CreatorProfile): Promise<void> {
  const key = `${WALLET_INDEX_PREFIX}${normalizeAddress(profile.walletAddress)}`
  const existing = (await kv.get<string[]>(key)) || []
  if (!existing.includes(profile.handle.toLowerCase())) {
    existing.push(profile.handle.toLowerCase())
    await kv.set(key, existing)
  }
}

export async function getProfileByWallet(walletAddress: string): Promise<CreatorProfile | null> {
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

// --- Lifetime aggregates ----------------------------------------------------
// The tip list is trimmed to the most recent 200 entries, so anything that must
// be correct for the lifetime of a wall (totals, milestones, replay protection)
// lives in persistent aggregates instead of being recomputed from the list.

const LUNA_PER_NIM = 100000

/**
 * Atomically record a txHash for a creator. Returns true the first time a hash
 * is seen and false on any repeat — lifetime replay protection that, unlike the
 * tip list, never forgets old hashes.
 */
export async function markTxSeen(handle: string, txHash: string): Promise<boolean> {
  const added = await kv.sadd(`${PREFIX}txseen:${handle.toLowerCase()}`, txHash)
  return added === 1
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
  return tips.map(t => (t.anonymous ? { ...t, senderAddress: '' } : t))
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
    `${PREFIX}vtotal:${h}`,
    `${PREFIX}milestones:${h}`,
  )

  // Funnel counters: all-time totals plus every per-day key.
  try {
    const statKeys = await kv.keys(`${PREFIX}stats:${h}:*`)
    if (statKeys.length) await kv.del(...statKeys)
  } catch {
    // Best effort — orphaned counters carry no PII and reference nothing.
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

  const updates = new Map<string, 'verify' | 'remove'>()
  for (const t of pending) {
    const res = await verifyTx(t.txHash, walletAddress, Math.round(t.amountNIM * 100000), 1)
    if (res === 'verified') updates.set(t.id, 'verify')
    else if (res === 'mismatch') updates.set(t.id, 'remove')
  }
  if (!updates.size) return tips

  // Rebuild from the current list so a tip added since our read isn't lost.
  const current = await getTips(handle)
  const rebuilt = current
    .filter(t => updates.get(t.id) !== 'remove')
    .map(t => (updates.get(t.id) === 'verify' ? { ...t, verified: true } : t))

  await kv.del(key)
  // getTips returns newest-first (lpush order); rpush in that same order preserves it.
  // Known (tiny) race: a tip lpush'd between the del and the rpush would be lost;
  // the window is one round-trip and reverify only runs when something changed.
  if (rebuilt.length) await kv.rpush(key, ...rebuilt)

  // Tips that just confirmed on-chain now count toward the lifetime total, and
  // may push the wall over a milestone the submit-time check couldn't award.
  for (const t of current) {
    if (updates.get(t.id) !== 'verify') continue
    const prevTotal = await getVerifiedTotalNim(handle)
    const newTotal = await addVerifiedNim(handle, t.amountNIM)
    const event = checkMilestone(prevTotal, newTotal, t.anonymous ? 'Anonymous' : t.senderAddress)
    if (event) await addMilestone(handle, event)
  }
  return rebuilt
}

/** Sum of NIM from verified tips only — unverified/pending tips don't count so a
 *  fabricated txHash can't inflate headline totals until it confirms on-chain. */
export function verifiedTotal(tips: Tip[]): number {
  return tips.reduce((sum, t) => sum + (t.verified ? t.amountNIM : 0), 0)
}

export async function getSupporters(handle: string): Promise<Supporter[]> {
  // Derive supporters from verified, NON-anonymous tips only: pending/forged
  // tips don't appear until they confirm, and an anonymous tipper's address
  // must never surface on the supporters wall or the top-supporter card.
  // (Derived from the most recent 200 tips — a "recent supporters" view.)
  const tips = (await getTips(handle)).filter(t => t.verified && !t.anonymous)
  const supportersMap = new Map<string, Supporter>()

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
    }
  })

  return Array.from(supportersMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
}

export async function getMilestones(handle: string): Promise<MilestoneEvent[]> {
  const key = `${PREFIX}milestones:${handle.toLowerCase()}`
  return (await kv.get<MilestoneEvent[]>(key)) || []
}

export async function addMilestone(handle: string, event: MilestoneEvent): Promise<boolean> {
  const existing = await getMilestones(handle)
  if (existing.some(m => m.threshold === event.threshold)) return false
  const updated = [...existing, event].sort((a, b) => a.threshold - b.threshold)
  await kv.set(`${PREFIX}milestones:${handle.toLowerCase()}`, updated)
  return true
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
    if (cached) return cached

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(timeout)

    if (!resp.ok) return null

    const html = await resp.text()
    if (!html) return null

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
