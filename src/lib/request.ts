/**
 * Return a stable rate-limit identity for an incoming request.
 *
 * Forwarding headers are only trustworthy when the deployment's edge proxy
 * owns and sanitizes them. Vercel does; other deployments must opt in with
 * TIPWALL_TRUST_PROXY=1 after configuring their ingress accordingly. The
 * default is deliberately fail-closed: forged headers cannot bypass a shared
 * limiter, though unconfigured non-Vercel deployments will share one bucket.
 */
export function getClientIp(request: Request): string {
  const trustedProxy = process.env.VERCEL === '1' || process.env.TIPWALL_TRUST_PROXY === '1'
  if (!trustedProxy) return 'untrusted-proxy'

  const vercelIp = request.headers.get('x-real-ip')?.trim()
  if (vercelIp) return vercelIp.slice(0, 64)

  const forwarded = request.headers.get('x-forwarded-for')
  // A configured ingress appends the address it observed. Taking the rightmost
  // hop avoids accepting an attacker-controlled prefix in the forwarded list.
  const lastHop = forwarded?.split(',').map(value => value.trim()).filter(Boolean).pop()
  return (lastHop || 'unknown').slice(0, 64)
}
