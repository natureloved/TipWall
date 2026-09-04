import { describe, expect, it } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { addressFromPublicKey, verifyNimiqSignedMessage, verifyWallSnapshot } from '../verify-signature'
import { NIMIQ_MSG_PREFIX, normalizeAddress } from '../profile-auth'
import {
  buildSignedWallSnapshot,
  buildWallSnapshotMessage,
  buildWallSnapshotPayload,
  canonicalJson,
  type WallSnapshotPayload,
} from '../wall-snapshot'

const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const privateKey = new Uint8Array(32).fill(7)
const publicKey = ed25519.getPublicKey(privateKey)
const ownerAddress = addressFromPublicKey(publicKey)

function makePayload(overrides: Partial<WallSnapshotPayload> = {}): WallSnapshotPayload {
  return {
    format: 'tipwall-wall-snapshot',
    version: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    profile: {
      handle: 'alice',
      displayName: 'Alice',
      bio: 'Hello',
      contentUrl: '',
      walletAddress: ownerAddress,
      ownerPublicKey: toHex(publicKey),
      createdAt: 1,
    },
    tips: [],
    supporters: [],
    milestones: [],
    totals: { totalNIM: 12, totalTips: 1 },
    ...overrides,
  }
}

function signPayload(payload: WallSnapshotPayload) {
  const message = buildWallSnapshotMessage(payload)
  const hash = sha256(new TextEncoder().encode(NIMIQ_MSG_PREFIX + message.length + message))
  return buildSignedWallSnapshot(payload, {
    publicKey: toHex(publicKey),
    signature: toHex(ed25519.sign(hash, privateKey)),
  })
}

describe('canonicalJson', () => {
  it('is stable when object keys are inserted in a different order', () => {
    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: [2, { d: 4, c: 3 }] }))
      .toBe(canonicalJson({ a: [2, { c: 3, d: 4 }], z: 1, nested: { a: 1, b: 2 } }))
  })
})

describe('wall snapshots', () => {
  it('omits owner secrets and internal verification fields', () => {
    const payload = buildWallSnapshotPayload({
      profile: {
        ...makePayload().profile,
        notifyTelegram: 'https://api.telegram.org/bot-secret',
        recoveryWalletAddress: ownerAddress,
      },
      tips: [{
        id: 'tip-1', handle: 'alice', senderAddress: ownerAddress, amountNIM: 1,
        txHash: 'a', verified: true, anonymous: true, timestamp: 1,
        verificationAttempts: 2, nextVerificationAt: 3, message: 'hello',
      }],
      totalNIM: 1,
      totalTips: 1,
    })
    expect(payload.profile).not.toHaveProperty('notifyTelegram')
    expect(payload.profile).not.toHaveProperty('recoveryWalletAddress')
    expect(payload.tips[0]).not.toHaveProperty('verificationAttempts')
    expect(payload.tips[0]).not.toHaveProperty('nextVerificationAt')
    expect(payload.tips[0].senderAddress).toBe('')
  })

  it('exports only confirmed public rows', () => {
    const base = {
      id: 'tip', handle: 'alice', senderAddress: ownerAddress, amountNIM: 1,
      txHash: 'a', anonymous: false, timestamp: 1,
    }
    const payload = buildWallSnapshotPayload({
      profile: makePayload().profile,
      tips: [
        { ...base, id: 'confirmed', verified: true },
        { ...base, id: 'pending', verified: false },
        { ...base, id: 'hidden', verified: true, hiddenAt: 2 },
      ],
      totalNIM: 1,
      totalTips: 2,
    })
    expect(payload.tips.map(tip => tip.id)).toEqual(['confirmed'])
  })

  it('verifies a valid Nimiq signature and binds it to the profile wallet', () => {
    const snapshot = signPayload(makePayload())
    const verdict = verifyWallSnapshot(snapshot)
    expect(verdict.ok).toBe(true)
    expect(verdict.signerAddress).toBe(normalizeAddress(snapshot.profile.walletAddress))
  })

  it('rejects modified payloads, signatures, and public keys', () => {
    const snapshot = signPayload(makePayload())
    const { signature, ...payload } = snapshot
    const changed = { ...payload, totals: { ...payload.totals, totalNIM: 99 } }
    expect(verifyNimiqSignedMessage(buildWallSnapshotMessage(changed), signature.publicKey, signature.signature).ok).toBe(false)
    expect(verifyNimiqSignedMessage(buildWallSnapshotMessage(payload), signature.publicKey, `${signature.signature.slice(0, -2)}00`).ok).toBe(false)

    const otherPrivateKey = new Uint8Array(32).fill(9)
    const otherPublicKey = ed25519.getPublicKey(otherPrivateKey)
    expect(verifyNimiqSignedMessage(buildWallSnapshotMessage(payload), toHex(otherPublicKey), signature.signature).ok).toBe(false)
  })

  it('rejects a valid signature when the snapshot claims a different owner wallet', () => {
    const payload = makePayload()
    const otherPrivateKey = new Uint8Array(32).fill(9)
    const otherAddress = addressFromPublicKey(ed25519.getPublicKey(otherPrivateKey))
    const claimed = { ...payload, profile: { ...payload.profile, walletAddress: otherAddress } }
    const message = buildWallSnapshotMessage(claimed)
    const hash = sha256(new TextEncoder().encode(NIMIQ_MSG_PREFIX + message.length + message))
    const signature = {
      scheme: 'nimiq-signed-message-v1' as const,
      publicKey: toHex(publicKey),
      signature: toHex(ed25519.sign(hash, privateKey)),
    }
    const verdict = verifyWallSnapshot({ ...claimed, signature })
    expect(verdict.ok).toBe(false)
    expect(verdict.error).toMatch(/profile wallet/i)
  })

  it('rejects a valid signature when the embedded owner key is different', () => {
    const otherPrivateKey = new Uint8Array(32).fill(9)
    const otherPublicKey = ed25519.getPublicKey(otherPrivateKey)
    const payload = makePayload({ profile: { ...makePayload().profile, ownerPublicKey: toHex(otherPublicKey) } })
    const snapshot = signPayload(payload)
    const verdict = verifyWallSnapshot(snapshot)
    expect(verdict.ok).toBe(false)
    expect(verdict.error).toMatch(/owner key/i)
  })
})
