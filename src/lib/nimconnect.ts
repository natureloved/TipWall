import { createProfileClient } from '@nimconnect/profile-client'
import type { Supporter } from './types'

type HandleResolver = (address: string) => Promise<{ handle: string } | null>

const profileClient = createProfileClient()

const resolveHandleByAddress: HandleResolver = address =>
  profileClient.getHandleByAddress(address)

const FEATURED_SUPPORTER_LIMIT = 12

export async function enrichSupportersWithNimConnectHandles(
  supporters: Supporter[],
  resolve: HandleResolver = resolveHandleByAddress,
): Promise<Supporter[]> {
  const featured = supporters.slice(0, FEATURED_SUPPORTER_LIMIT)
  const enriched = await Promise.all(featured.map(async supporter => {
    try {
      const claim = await resolve(supporter.address)
      return claim?.handle
        ? { ...supporter, nimConnectHandle: claim.handle }
        : supporter
    } catch {
      return supporter
    }
  }))
  return [...enriched, ...supporters.slice(FEATURED_SUPPORTER_LIMIT)]
}
