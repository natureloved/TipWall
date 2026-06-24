// Server-side verification of Nimiq signed messages for the signature-bound
// create/edit flow.
//
// Nimiq Keyguard signing scheme (see https://nimiq.github.io/hub/api-reference/sign-message):
//   sign( sha256( '\x16Nimiq Signed Message:\n' + message.length + message ) )
//
// A Nimiq address is the first 20 bytes of blake2b-256(publicKey), rendered in
// the user-friendly "NQ.." IBAN-style format. To bind a signature to a claimed
// address we re-derive the address from the signer public key and compare.

import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { blake2b } from '@noble/hashes/blake2.js'
import {
  NIMIQ_MSG_PREFIX,
  PROFILE_AUTH_TTL_MS,
  buildProfileAuthMessage,
  normalizeAddress,
  type ProfileAuthProof,
} from './profile-auth'

const textEncoder = new TextEncoder()

/** Decode a hex or base64 string into bytes (Mini App SDK returns hex). */
function decodeBytes(input: string): Uint8Array {
  const s = (input || '').trim()
  if (/^(0x)?[0-9a-fA-F]+$/.test(s) && s.replace(/^0x/, '').length % 2 === 0) {
    const hex = s.replace(/^0x/, '')
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return out
  }
  // Fallback: base64 / base64url
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = Buffer.from(b64, 'base64')
  return new Uint8Array(bin)
}

/** Compute the 32-byte hash that the Nimiq wallet actually signs. */
function hashSignedMessage(message: string): Uint8Array {
  const prefixed = NIMIQ_MSG_PREFIX + message.length + message
  return sha256(textEncoder.encode(prefixed))
}

const NIMIQ_BASE32_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

/** Derive the user-friendly "NQ.." address from a 32-byte Ed25519 public key. */
export function addressFromPublicKey(publicKey: Uint8Array): string {
  const hash = blake2b(publicKey, { dkLen: 32 })
  const addrBytes = hash.slice(0, 20)

  // Base32-encode the 20 address bytes (160 bits -> 32 chars).
  let bits = 0
  let value = 0
  let base32 = ''
  for (const byte of addrBytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      base32 += NIMIQ_BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) base32 += NIMIQ_BASE32_ALPHABET[(value << (5 - bits)) & 31]

  // IBAN-style mod-97 checksum over "<base32>NQ00".
  const check = ibanCheck(base32 + 'NQ00')
  const checkDigits = ('0' + (98 - check)).slice(-2)
  return `NQ${checkDigits}${base32}`
}

/** mod-97 over the alphanumeric IBAN representation (letters -> 10..35). */
function ibanCheck(str: string): number {
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

export interface VerifyResult {
  ok: boolean
  /** Re-derived, normalized signer address (only set when signature is valid). */
  signerAddress?: string
  error?: string
}

/**
 * Verify a profile authorization proof:
 *  1. timestamp freshness (anti-replay)
 *  2. Ed25519 signature over the canonical message
 *  3. the signing key derives to the claimed wallet address
 */
export function verifyProfileAuth(proof: ProfileAuthProof, now: number = Date.now()): VerifyResult {
  try {
    if (!proof || !proof.signature || !proof.publicKey) {
      return { ok: false, error: 'Missing signature' }
    }
    if (!Number.isFinite(proof.issuedAt)) {
      return { ok: false, error: 'Missing or invalid timestamp' }
    }
    const age = now - proof.issuedAt
    if (age > PROFILE_AUTH_TTL_MS || age < -PROFILE_AUTH_TTL_MS) {
      return { ok: false, error: 'Signature expired, please sign again' }
    }

    const message = buildProfileAuthMessage({
      action: proof.action,
      handle: proof.handle,
      walletAddress: proof.walletAddress,
      issuedAt: proof.issuedAt,
    })

    const publicKey = decodeBytes(proof.publicKey)
    const signature = decodeBytes(proof.signature)
    if (publicKey.length !== 32) return { ok: false, error: 'Invalid public key' }
    if (signature.length !== 64) return { ok: false, error: 'Invalid signature' }

    const hash = hashSignedMessage(message)
    const valid = ed25519.verify(signature, hash, publicKey)
    if (!valid) return { ok: false, error: 'Signature does not match message' }

    const derived = addressFromPublicKey(publicKey)
    if (normalizeAddress(derived) !== normalizeAddress(proof.walletAddress)) {
      return { ok: false, error: 'Signature does not match the provided wallet address' }
    }

    return { ok: true, signerAddress: normalizeAddress(derived) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return { ok: false, error: msg }
  }
}
