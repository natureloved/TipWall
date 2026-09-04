// Shared, dependency-free helpers for the signature-bound create/edit flow.
// This module MUST stay identical in behaviour on the client and the server so
// that the message the wallet signs is byte-for-byte the message the server
// verifies. Keep it free of any browser- or node-specific imports.

export type ProfileAuthAction = 'create' | 'update' | 'view' | 'delete' | 'transfer'

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

// --- Nimiq address validation ------------------------------------------------
// A user-friendly Nimiq address is 36 chars: "NQ" + 2 IBAN check digits + a
// 32-char base32 body (the first 20 bytes of blake2b(publicKey)).

/** Base32 alphabet Nimiq uses — Crockford-style: no I, L, O or Z. */
export const NIMIQ_BASE32_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

/** Total length of a user-friendly Nimiq address, spaces excluded. */
export const NIMIQ_ADDRESS_LENGTH = 36

/** Length of the base32 body (160 bits -> 32 chars). */
const NIMIQ_BODY_LENGTH = 32

/**
 * mod-97 over the alphanumeric IBAN representation (letters -> 10..35).
 * Shared by address derivation and address validation so the two can never
 * disagree about what a valid address looks like.
 */
export function ibanCheck(str: string): number {
  let num = ''
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    num += code >= 48 && code <= 57 ? ch : (code - 55).toString()
  }
  let remainder = 0
  for (let i = 0; i < num.length; i += 6) {
    remainder = Number(remainder + num.slice(i, i + 6)) % 97
  }
  return remainder
}

/**
 * The two check digits that belong in front of a 32-char base32 body.
 * Single definition of the checksum: `addressFromPublicKey` uses it to build
 * addresses, `isValidNimiqAddress` uses it to check them.
 */
export function nimiqCheckDigits(base32: string): string {
  return ('0' + (98 - ibanCheck(base32 + 'NQ00'))).slice(-2)
}

/**
 * True when `address` is a structurally valid Nimiq address whose checksum
 * actually checks out — i.e. one money can really be sent to.
 *
 * This catches the failure that matters most: a creator typo's one character
 * while pasting their address, the wall is created, and every tip to it fails.
 * `startsWith('NQ')` does not catch that; mod-97 does (it catches every
 * single-character error and effectively all transpositions).
 */
export function isValidNimiqAddress(address: string): boolean {
  const a = normalizeAddress(address)
  if (a.length !== NIMIQ_ADDRESS_LENGTH) return false
  if (!a.startsWith('NQ')) return false

  const checkDigits = a.slice(2, 4)
  const body = a.slice(4)
  if (body.length !== NIMIQ_BODY_LENGTH) return false
  if (!/^\d{2}$/.test(checkDigits)) return false
  for (const ch of body) {
    if (!NIMIQ_BASE32_ALPHABET.includes(ch)) return false
  }
  return nimiqCheckDigits(body) === checkDigits
}

/** Short, user-presentable reason a Nimiq address was rejected (null if fine). */
export function nimiqAddressError(address: string): string | null {
  if (isValidNimiqAddress(address)) return null
  const a = normalizeAddress(address)
  if (!a) return 'Nimiq wallet address is required'
  if (!a.startsWith('NQ')) return 'Nimiq wallet address must start with NQ'
  if (a.length !== NIMIQ_ADDRESS_LENGTH) {
    return `Nimiq wallet address must be ${NIMIQ_ADDRESS_LENGTH} characters (got ${a.length})`
  }
  if (nimiqCheckDigits(a.slice(4)) !== a.slice(2, 4)) {
    return 'This Nimiq wallet address is not valid — please check it for typos'
  }
  return 'This Nimiq wallet address is not valid'
}

export interface ProfileAuthParams {
  action: ProfileAuthAction
  handle: string
  walletAddress: string
  /** Unix epoch milliseconds. Must match between signing and verifying. */
  issuedAt: number
  /** Destination wallet for the two-party ownership transfer proof. */
  transferTo?: string
}

/**
 * Build the canonical, human-readable message the wallet signs. Using a fixed,
 * ASCII-only layout keeps `message.length` unambiguous (UTF-16 length == byte
 * length) and lets the user clearly see what they are authorizing in the native
 * Nimiq Pay confirmation dialog.
 */
export function buildProfileAuthMessage(params: ProfileAuthParams): string {
  const { action, handle, walletAddress, issuedAt, transferTo } = params
  const lines = [
    'TipWall account authorization',
    `action: ${action}`,
    `handle: ${normalizeHandle(handle)}`,
    `wallet: ${normalizeAddress(walletAddress)}`,
    `issued: ${issuedAt}`,
  ]
  if (action === 'transfer') lines.push(`transfer-to: ${normalizeAddress(transferTo || '')}`)
  return lines.join('\n')
}

/** Shape sent from the client to the API alongside the profile payload. */
export interface ProfileAuthProof {
  action: ProfileAuthAction
  handle: string
  walletAddress: string
  issuedAt: number
  transferTo?: string
  /** Signer public key, hex-encoded (as returned by the Mini App SDK). */
  publicKey: string
  /** Signature over the canonical message, hex-encoded. */
  signature: string
}
