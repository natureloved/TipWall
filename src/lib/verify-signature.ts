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
  NIMIQ_BASE32_ALPHABET,
  PROFILE_AUTH_TTL_MS,
  buildProfileAuthMessage,
  nimiqCheckDigits,
  normalizeAddress,
  type ProfileAuthProof,
} from './profile-auth'
import { buildWallSnapshotMessage, type SignedWallSnapshot } from './wall-snapshot'

const textEncoder = new TextEncoder()

/** Decode a hex or base64 string into bytes (Mini App SDK returns hex). */
export function decodeBytes(input: string): Uint8Array {
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
export function hashSignedMessage(message: string): Uint8Array {
  const prefixed = NIMIQ_MSG_PREFIX + message.length + message
  return sha256(textEncoder.encode(prefixed))
}

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

  // IBAN-style mod-97 checksum over "<base32>NQ00". Uses the same helper the
  // address validator uses, so a derived address always validates.
  return `NQ${nimiqCheckDigits(base32)}${base32}`
}

export interface VerifyResult {
  ok: boolean
  /** Re-derived, normalized signer address (only set when signature is valid). */
  signerAddress?: string
  error?: string
}

/** Verify a Nimiq signed-message envelope and derive the signing wallet. */
export function verifyNimiqSignedMessage(
  message: string,
  publicKeyInput: string,
  signatureInput: string,
): VerifyResult {
  try {
    if (!publicKeyInput || !signatureInput) return { ok: false, error: 'Missing signature' }
    const publicKey = decodeBytes(publicKeyInput)
    const signature = decodeBytes(signatureInput)
    if (publicKey.length !== 32) return { ok: false, error: 'Invalid public key' }
    if (signature.length !== 64) return { ok: false, error: 'Invalid signature' }

    const valid = ed25519.verify(signature, hashSignedMessage(message), publicKey)
    if (!valid) return { ok: false, error: 'Signature does not match message' }
    return { ok: true, signerAddress: normalizeAddress(addressFromPublicKey(publicKey)) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return { ok: false, error: msg }
  }
}

/** Verify a signed wall snapshot, including its owner-wallet binding. */
export function verifyWallSnapshot(snapshot: SignedWallSnapshot): VerifyResult {
  try {
    if (!snapshot || snapshot.format !== 'tipwall-wall-snapshot' || snapshot.version !== 1) {
      return { ok: false, error: 'Unsupported wall snapshot format' }
    }
    if (!snapshot.profile?.walletAddress || !snapshot.signature || snapshot.signature.scheme !== 'nimiq-signed-message-v1') {
      return { ok: false, error: 'Incomplete wall snapshot' }
    }
    const { signature, ...payload } = snapshot
    const verdict = verifyNimiqSignedMessage(
      buildWallSnapshotMessage(payload),
      signature.publicKey,
      signature.signature,
    )
    if (!verdict.ok) return verdict
    if (verdict.signerAddress !== normalizeAddress(snapshot.profile.walletAddress)) {
      return { ok: false, error: 'Snapshot signature does not match the profile wallet' }
    }
    if (snapshot.profile.ownerPublicKey) {
      const signerKey = decodeBytes(signature.publicKey)
      const ownerKey = decodeBytes(snapshot.profile.ownerPublicKey)
      if (signerKey.length !== ownerKey.length || signerKey.some((byte, i) => byte !== ownerKey[i])) {
        return { ok: false, error: 'Snapshot signature does not match the profile owner key' }
      }
    }
    return verdict
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return { ok: false, error: msg }
  }
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
      transferTo: proof.transferTo,
    })

    const signed = verifyNimiqSignedMessage(message, proof.publicKey, proof.signature)
    if (!signed.ok) return signed

    if (normalizeAddress(signed.signerAddress || '') !== normalizeAddress(proof.walletAddress)) {
      return { ok: false, error: 'Signature does not match the provided wallet address' }
    }

    return signed
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return { ok: false, error: msg }
  }
}
