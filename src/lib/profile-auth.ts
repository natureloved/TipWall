// Shared, dependency-free helpers for the signature-bound create/edit flow.
// This module MUST stay identical in behaviour on the client and the server so
// that the message the wallet signs is byte-for-byte the message the server
// verifies. Keep it free of any browser- or node-specific imports.

export type ProfileAuthAction = 'create' | 'update' | 'view' | 'delete'

/** The 23-byte prefix the Nimiq Keyguard prepends before hashing/signing. */
export const NIMIQ_MSG_PREFIX = '\x16Nimiq Signed Message:\n'

/** How long (ms) a signed authorization stays valid. Guards against replay. */
export const PROFILE_AUTH_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Normalize a Nimiq user-friendly address for comparison/canonicalization. */
export function normalizeAddress(address: string): string {
  return (address || '').replace(/\s+/g, '').toUpperCase()
}

/** Normalize a handle the same way the API persists it. */
export function normalizeHandle(handle: string): string {
  return (handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export interface ProfileAuthParams {
  action: ProfileAuthAction
  handle: string
  walletAddress: string
  /** Unix epoch milliseconds. Must match between signing and verifying. */
  issuedAt: number
}

/**
 * Build the canonical, human-readable message the wallet signs. Using a fixed,
 * ASCII-only layout keeps `message.length` unambiguous (UTF-16 length == byte
 * length) and lets the user clearly see what they are authorizing in the native
 * Nimiq Pay confirmation dialog.
 */
export function buildProfileAuthMessage(params: ProfileAuthParams): string {
  const { action, handle, walletAddress, issuedAt } = params
  return [
    'TipWall account authorization',
    `action: ${action}`,
    `handle: ${normalizeHandle(handle)}`,
    `wallet: ${normalizeAddress(walletAddress)}`,
    `issued: ${issuedAt}`,
  ].join('\n')
}

/** Shape sent from the client to the API alongside the profile payload. */
export interface ProfileAuthProof {
  action: ProfileAuthAction
  handle: string
  walletAddress: string
  issuedAt: number
  /** Signer public key, hex-encoded (as returned by the Mini App SDK). */
  publicKey: string
  /** Signature over the canonical message, hex-encoded. */
  signature: string
}
