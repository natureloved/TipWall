export type AuthAction = 'create' | 'edit'

/**
 * Canonical, human-readable message a creator signs to prove wallet ownership.
 * Built in exactly one place so the challenge endpoint and the verifier can
 * never disagree on the bytes. The nonce makes each signature single-use.
 */
export function buildAuthMessage(action: AuthAction, handle: string, nonce: string): string {
  return [
    `TipWall ${action} authorization`,
    `handle: ${handle.toLowerCase()}`,
    `nonce: ${nonce}`,
  ].join('\n')
}

/** Nimiq user-friendly addresses are case-insensitive and space-formatted. */
export function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, '').toUpperCase()
}
