import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent, ClaimIntent } from './types'
import { FUNNEL_EVENTS, type FunnelEvent } from './events'
import { verifyTx } from './verify-tx'

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
  const count = await kv.incr(key)
  if (count === 1) {
    // First hit in a new window — arm the expiry (seconds granularity).
    await kv.expire(key, Math.ceil(windowMs / 1000))
  }
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

export async function addTip(handle: string, tip: Tip): Promise<void> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  // Use an atomic list push instead of read-modify-write so concurrent tips
  // to the same creator can't clobber each other (lost-update race).
  await kv.lpush(key, tip)
  await kv.ltrim(key, 0, 199)
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
  if (rebuilt.length) await kv.rpush(key, ...rebuilt)
  return rebuilt
}

/** Sum of NIM from verified tips only — unverified/pending tips don't count so a
 *  fabricated txHash can't inflate headline totals until it confirms on-chain. */
export function verifiedTotal(tips: Tip[]): number {
  return tips.reduce((sum, t) => sum + (t.verified ? t.amountNIM : 0), 0)
}

export async function getSupporters(handle: string): Promise<Supporter[]> {
  // Derive supporters from verified tips only, so pending/forged tips don't
  // appear on the wall or the top-supporter card until they confirm.
  const tips = (await getTips(handle)).filter(t => t.verified)
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

export async function getTotalNim(handle: string): Promise<number> {
  const tips = await getTips(handle)
  return tips.reduce((sum, t) => sum + t.amountNIM, 0)
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
