// Shared (client + server) helpers for the "scan to pay" flow.
//
// A tip can complete two ways:
//   1. Inside Nimiq Pay (mini-app SDK) — the original path, direct txHash.
//   2. By scanning a `nimiq:` payment-request QR with the Nimiq Pay app from any
//      device. The payment happens OUTSIDE this app, so we get no txHash back.
//      To attribute it, we embed a short nonce in the on-chain message and poll
//      the chain for the matching incoming transaction (see /api/tips/detect).
//
// URI format follows @nimiq/utils RequestLinkEncoding (NimiqRequestLinkType.URI):
//   nimiq:<ADDRESS>?amount=<NIM>&message=<uriEncoded>
// - address: spaces stripped
// - amount:  in NIM (decimal), not luna
// - message: URI-encoded, on-chain `extra_data`, hard limit 64 BYTES

/** On-chain message byte cap enforced by Nimiq core (BasicAccount). */
export const MESSAGE_MAX_BYTES = 64

/** Nonce tag prefix embedded in the message so we can match the paid tx. */
const NONCE_PREFIX = '#'

/** Generate a short, URL/message-safe attribution nonce (base36). */
export function generatePayNonce(): string {
  // 6 base36 chars ≈ 2 billion combos — ample within one creator+amount window.
  const rand = Math.floor(Math.random() * 36 ** 6)
  return rand.toString(36).padStart(6, '0')
}

/** Byte length of a UTF-8 string (message limit is bytes, not chars). */
function byteLength(s: string): number {
  return typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(s).length
    : unescape(encodeURIComponent(s)).length
}

/** Trim a string to at most `maxBytes` UTF-8 bytes without splitting a char. */
function trimToBytes(s: string, maxBytes: number): string {
  if (byteLength(s) <= maxBytes) return s
  let out = s
  while (out.length && byteLength(out) > maxBytes) out = out.slice(0, -1)
  return out
}

/**
 * Compose the on-chain message: the user's text plus a ` #nonce` attribution
 * tag, trimmed so the whole thing fits in 64 bytes (tag is preserved first).
 */
export function composePayMessage(userMessage: string | undefined, nonce: string): string {
  const tag = `${NONCE_PREFIX}${nonce}`
  const text = (userMessage || '').trim()
  if (!text) return tag
  // Reserve room for " " + tag; trim the user text to fit the remainder.
  const reserved = tag.length + 1
  const room = MESSAGE_MAX_BYTES - reserved
  if (room <= 0) return tag
  const trimmed = trimToBytes(text, room)
  return `${trimmed} ${tag}`
}

/** True if an on-chain message carries this attribution nonce. */
export function messageHasNonce(message: string | undefined, nonce: string): boolean {
  if (!message || !nonce) return false
  return message.includes(`${NONCE_PREFIX}${nonce}`)
}

/**
 * Build a `nimiq:` payment-request URI that the Nimiq Pay app's scanner opens as
 * a prefilled payment. `message` should already include the attribution nonce.
 */
export function buildNimiqPaymentLink(params: {
  address: string
  amountNIM: number
  message?: string
}): string {
  const recipient = params.address.replace(/ /g, '')
  const query = [`amount=${params.amountNIM}`]
  const message = params.message ? trimToBytes(params.message, MESSAGE_MAX_BYTES) : ''
  if (message) query.push(`message=${encodeURIComponent(message)}`)
  return `nimiq:${recipient}?${query.join('&')}`
}
