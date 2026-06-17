import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent } from './types'

const PREFIX = 'tipwall:'

export async function getProfile(handle: string): Promise<CreatorProfile | null> {
  const raw = await kv.get<CreatorProfile>(`${PREFIX}profile:${handle.toLowerCase()}`)
  return raw ?? null
}

export async function setProfile(profile: CreatorProfile): Promise<void> {
  await kv.set(`${PREFIX}profile:${profile.handle.toLowerCase()}`, profile)
}

export async function addTip(handle: string, tip: Tip): Promise<void> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const existing = (await kv.get<Tip[]>(key)) || []
  const updated = [tip, ...existing].slice(0, 200)
  await kv.set(key, updated)
}

export async function getTips(handle: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  return (await kv.get<Tip[]>(key)) || []
}

export async function getSupporters(handle: string): Promise<Supporter[]> {
  const key = `${PREFIX}supporters:${handle.toLowerCase()}`
  return (await kv.get<Supporter[]>(key)) || []
}

export async function upsertSupporter(handle: string, tip: { senderAddress: string; amountNIM: number; timestamp: number }): Promise<void> {
  const key = `${PREFIX}supporters:${handle.toLowerCase()}`
  const list = await getSupporters(handle)
  const idx = list.findIndex(s => s.address === tip.senderAddress)
  if (idx >= 0) {
    list[idx].totalNIM += tip.amountNIM
    list[idx].tipCount += 1
    list[idx].firstTipAt = Math.min(list[idx].firstTipAt, tip.timestamp)
  } else {
    list.push({ address: tip.senderAddress, totalNIM: tip.amountNIM, tipCount: 1, firstTipAt: tip.timestamp })
  }
  list.sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
  await kv.set(key, list)
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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    clearTimeout(timeout)
    if (!resp.ok) return null
    const html = await resp.text()
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
  } catch {
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
