import { checkRateLimit } from './kv'
import { getClientIp } from './request'

/** Apply a distributed per-client limit to an API request. */
export function withinRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000): Promise<boolean> {
  return checkRateLimit(`${scope}:${getClientIp(request)}`, limit, windowMs)
}
