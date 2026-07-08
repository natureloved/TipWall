import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { addressFromPublicKey, verifyProfileAuth } from '../verify-signature'
import {
  NIMIQ_MSG_PREFIX,
  buildProfileAuthMessage,
  normalizeAddress,
  type ProfileAuthProof,
} from '../profile-auth'

const PRIV = new Uint8Array(32).fill(7)
const PUB = ed25519.getPublicKey(PRIV)
const WALLET = addressFromPublicKey(PUB)

const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')

/** Sign exactly the way the Nimiq Keyguard does: sha256 over the prefixed message. */
function makeProof(overrides: Partial<ProfileAuthProof> = {}): ProfileAuthProof {
  const fields = {
    action: 'create' as const,
    handle: 'alice',
    walletAddress: WALLET,
    issuedAt: Date.now(),
    ...overrides,
  }
  const message = buildProfileAuthMessage(fields)
  const hash = sha256(new TextEncoder().encode(NIMIQ_MSG_PREFIX + message.length + message))
  return {
    ...fields,
    publicKey: overrides.publicKey ?? toHex(PUB),
    signature: overrides.signature ?? toHex(ed25519.sign(hash, PRIV)),
  }
}

describe('addressFromPublicKey', () => {
  it('produces a Nimiq user-friendly address with a valid IBAN checksum', () => {
    expect(WALLET).toMatch(/^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/)
    // Independent IBAN mod-97 validation: move the first 4 chars to the end,
    // map letters to 10..35, and the remainder must be 1.
    const rearranged = WALLET.slice(4) + WALLET.slice(0, 4)
    let num = ''
    for (const ch of rearranged) {
      const code = ch.charCodeAt(0)
      num += code >= 48 && code <= 57 ? ch : (code - 55).toString()
    }
    let remainder = 0
    for (const digit of num) remainder = (remainder * 10 + Number(digit)) % 97
    expect(remainder).toBe(1)
  })

  it('is deterministic', () => {
    expect(addressFromPublicKey(PUB)).toBe(WALLET)
  })
})

describe('verifyProfileAuth', () => {
  it('accepts a valid, fresh proof and derives the signer address', () => {
    const verdict = verifyProfileAuth(makeProof())
    expect(verdict.ok).toBe(true)
    expect(verdict.signerAddress).toBe(normalizeAddress(WALLET))
  })

  it('rejects an expired proof', () => {
    const verdict = verifyProfileAuth(makeProof({ issuedAt: Date.now() - 10 * 60 * 1000 }))
    expect(verdict.ok).toBe(false)
    expect(verdict.error).toMatch(/expired/i)
  })

  it('rejects a proof issued too far in the future', () => {
    const verdict = verifyProfileAuth(makeProof({ issuedAt: Date.now() + 10 * 60 * 1000 }))
    expect(verdict.ok).toBe(false)
  })

  it('rejects a tampered message (handle changed after signing)', () => {
    const proof = makeProof()
    const verdict = verifyProfileAuth({ ...proof, handle: 'mallory' })
    expect(verdict.ok).toBe(false)
  })

  it('rejects a signature from a key that does not match the claimed wallet', () => {
    const otherPriv = new Uint8Array(32).fill(9)
    const otherPub = ed25519.getPublicKey(otherPriv)
    const base = { action: 'create' as const, handle: 'alice', walletAddress: WALLET, issuedAt: Date.now() }
    const message = buildProfileAuthMessage(base)
    const hash = sha256(new TextEncoder().encode(NIMIQ_MSG_PREFIX + message.length + message))
    const signature = ed25519.sign(hash, otherPriv)
    const verdict = verifyProfileAuth({ ...base, publicKey: toHex(otherPub), signature: toHex(signature) })
    expect(verdict.ok).toBe(false)
    expect(verdict.error).toMatch(/wallet address/i)
  })

  it('rejects malformed keys and signatures', () => {
    expect(verifyProfileAuth(makeProof({ publicKey: 'abcd' })).ok).toBe(false)
    expect(verifyProfileAuth(makeProof({ signature: 'abcd' })).ok).toBe(false)
    expect(verifyProfileAuth({ ...makeProof(), signature: '' }).ok).toBe(false)
  })
})
