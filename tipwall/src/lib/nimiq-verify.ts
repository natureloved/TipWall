import { createHash } from 'crypto'
import { AuthAction, buildAuthMessage, normalizeAddress } from './auth'

/** Nimiq "Signed Message" prefix (HubApi.MSG_PREFIX), 23 bytes. */
const MSG_PREFIX = '\x16Nimiq Signed Message:\n'

/**
 * The bytes the host wallet actually signs for `provider.sign({ message })`.
 *
 * The Nimiq Keyguard does NOT sign the raw message — it signs the SHA-256 of a
 * prefixed string so a signed message can never be mistaken for a transaction:
 *   sha256( '\x16Nimiq Signed Message:\n' + message.length + message )
 * `message.length` is the JS string length (UTF-16 code units) as a decimal
 * string, matching the Hub's reference verification.
 */
function bytesThatWereSigned(message: string): Uint8Array {
  const data = MSG_PREFIX + message.length + message
  return new Uint8Array(createHash('sha256').update(Buffer.from(data, 'utf-8')).digest())
}

export type VerifyResult =
  | { ok: true; address: string }
  | { ok: false; error: string }

/**
 * Verify a wallet signature over the canonical auth message.
 *
 * @param publicKey hex Ed25519 public key. For `create` this is supplied by the
 *   client; for `edit` pass the profile's bound `ownerPublicKey` so the signature
 *   must come from the original owner.
 * Returns the user-friendly address derived from the public key on success.
 */
export async function verifyWalletSignature(params: {
  action: AuthAction
  handle: string
  nonce: string
  publicKey: string
  signature: string
}): Promise<VerifyResult> {
  const { action, handle, nonce, publicKey, signature } = params
  try {
    const Nimiq = await import('@nimiq/core')
    const pub = Nimiq.PublicKey.fromHex(publicKey)
    const sig = Nimiq.Signature.fromHex(signature)
    const data = bytesThatWereSigned(buildAuthMessage(action, handle, nonce))

    if (!pub.verify(sig, data)) {
      return { ok: false, error: 'signature does not match message' }
    }
    return { ok: true, address: pub.toAddress().toUserFriendlyAddress() }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'signature verification failed' }
  }
}

/** True if two Nimiq addresses refer to the same account (ignoring spacing/case). */
export function addressesMatch(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}
