import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent, ClaimIntent } from './types'
import { FUNNEL_EVENTS, type FunnelEvent } from './events'

const PREFIX = 'tipwall:'

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
  await kv.set(`${PREFIX}claim:${claim.token}`, claim)
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
  await kv.set(`${PREFIX}claim:${claim.token}`, claim)
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

export async function getSupporters(handle: string): Promise<Supporter[]> {
  // Always derive supporters from tips to ensure consistency
  const tips = await getTips(handle)
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
    // Validate URL format
    try {
      new URL(url)
    } catch {
      return null
    }
    
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
    
    return {
      title: getMeta('og:title') || getMeta('title') || 'Untitled',
      description: getMeta('og:description') || getMeta('description') || '',
      image: getMeta('og:image') || '',
      url: getMeta('og:url') || url,
      siteName: getMeta('og:site_name') || '',
    }
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

export async function upsertSupporter(handle: string, tip: { senderAddress: string; amountNIM: number; timestamp: number }): Promise<void> {
  const key = `${PREFIX}supporters:${handle.toLowerCase()}`
  const existing = (await kv.get<{ address: string; totalNIM: number; tipCount: number; firstTipAt: number }[]>(key)) || []
  
  const idx = existing.findIndex(s => s.address === tip.senderAddress)
  if (idx >= 0) {
    existing[idx].totalNIM += tip.amountNIM
    existing[idx].tipCount += 1
    existing[idx].firstTipAt = Math.min(existing[idx].firstTipAt, tip.timestamp)
  } else {
    existing.unshift({
      address: tip.senderAddress,
      totalNIM: tip.amountNIM,
      tipCount: 1,
      firstTipAt: tip.timestamp,
    })
  }
  
  existing.sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
  await kv.set(key, existing.slice(0, 200))
}
