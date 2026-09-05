import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'
import type { ErrorResponse } from '@nimiq/mini-app-sdk'
import {
  buildProfileAuthMessage,
  normalizeAddress,
  type ProfileAuthAction,
  type ProfileAuthProof,
} from './profile-auth'

let nimiqInstance: ReturnType<typeof init> | null = null
let nimiqCache: { senderAddress: string | null; deviceId: string | null } | null = null

/** Normalize account responses from the injected provider without trusting a
 * provider-specific wrapper shape. The SDK currently returns string[], but a
 * few host versions wrap it in { accounts } or { result }. */
export function extractAccountAddresses(value: unknown): string[] {
  const found: string[] = []
  const seen = new Set<object>()
  const visit = (current: unknown) => {
    if (typeof current === 'string') {
      const address = current.trim()
      if (address && !found.includes(address)) found.push(address)
      return
    }
    if (!current || typeof current !== 'object' || seen.has(current)) return
    seen.add(current)
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    const record = current as Record<string, unknown>
    for (const key of ['accounts', 'result', 'data']) {
      if (record[key] !== undefined) visit(record[key])
    }
  }
  visit(value)
  return found
}

function isSerializedTransaction(value: string): boolean {
  return /^(?:0x)?[0-9a-f]{200,}$/i.test(value)
}

async function broadcastSerializedTransaction(serializedTx: string): Promise<string> {
  const response = await fetch('/api/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedTx: serializedTx.replace(/^0x/i, '') }),
  })
  const data = await response.json().catch(() => ({})) as { hash?: unknown; error?: unknown }
  if (!response.ok || typeof data.hash !== 'string' || !data.hash) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not broadcast the transaction. Please try again.')
  }
  return data.hash
}

// Export a cached singleton - critical for Mini App context detection
export function getNimiq() {
  if (!nimiqInstance) {
    nimiqInstance = init()
  }
  return nimiqInstance
}

export async function initNimiq() {
  if (nimiqCache) return nimiqCache
  try {
    const nimiq = await getNimiq()
    const accounts = await nimiq.listAccounts()
    const senderAddress = extractAccountAddresses(accounts)[0] || null
    let deviceId: string | null = null
    try {
      const id = await requestDeviceIdentifier({ reason: 'Prevent tip spam and rate limiting' })
      deviceId = id || null
    } catch { }
    nimiqCache = { senderAddress, deviceId }
    return nimiqCache
  } catch {
    nimiqCache = { senderAddress: null, deviceId: null }
    return nimiqCache
  }
}

export async function getSenderAddresses(): Promise<string[]> {
  try {
    const nimiq = await getNimiq()
    const accounts = await nimiq.listAccounts()
    // Refresh the list on every payment-related read. Nimiq Pay users can
    // switch the selected account while the mini app remains open; returning
    // the cached first account would then show the wrong balance and attach
    // the wrong sender identity to the payment record.
    if (isErrorResponse(accounts)) return []
    const addresses = extractAccountAddresses(accounts)
    if (nimiqCache) nimiqCache.senderAddress = addresses[0] || null
    return addresses
  } catch {
    return []
  }
}

export async function getSenderAddress(): Promise<string | null> {
  return (await getSenderAddresses())[0] || null
}

/** Helper to read either { error } responses or plain values from the SDK. */
function isErrorResponse(v: unknown): v is ErrorResponse {
  return typeof v === 'object' && v !== null && 'error' in v
}

/**
 * Connect the in-app Nimiq wallet and return the user's first account address.
 * Throws a friendly error when not running inside Nimiq Pay.
 */
export async function connectWallet(): Promise<string> {
  let nimiq
  try {
    nimiq = await getNimiq()
  } catch {
    throw new Error('Open this app inside Nimiq Pay to connect your wallet.')
  }
  const accounts = await nimiq.listAccounts()
  if (isErrorResponse(accounts)) {
    throw new Error(accounts.error?.message || 'Could not list wallet accounts.')
  }
  const address = extractAccountAddresses(accounts)[0] || null
  if (!address) throw new Error('No Nimiq account found in the wallet.')
  if (nimiqCache) nimiqCache.senderAddress = address
  return address
}

/**
 * Produce a signature-bound authorization proof for creating or editing a
 * profile. The user approves a human-readable message in Nimiq Pay; the wallet
 * returns its public key + signature, which the server verifies and binds to
 * the wallet address.
 */
export async function signProfileAuth(params: {
  action: ProfileAuthAction
  handle: string
  walletAddress: string
  transferTo?: string
}): Promise<ProfileAuthProof> {
  const nimiq = await getNimiq()
  const walletAddress = normalizeAddress(params.walletAddress)
  const issuedAt = Date.now()
  const message = buildProfileAuthMessage({
    action: params.action,
    handle: params.handle,
    walletAddress,
    issuedAt,
    transferTo: params.transferTo,
  })

  const result = await nimiq.sign(message)
  if (isErrorResponse(result)) {
    throw new Error(result.error?.message || 'Signing was rejected.')
  }
  const { publicKey, signature } = result as { publicKey: string; signature: string }
  if (!publicKey || !signature) throw new Error('Wallet did not return a signature.')

  return {
    action: params.action,
    handle: params.handle,
    walletAddress,
    issuedAt,
    transferTo: params.transferTo,
    publicKey,
    signature,
  }
}

/** Sign a portable wall snapshot with the connected Nimiq wallet. */
export async function signWallSnapshot(message: string): Promise<{ publicKey: string; signature: string }> {
  const nimiq = await getNimiq()
  const result = await nimiq.sign(message)
  if (isErrorResponse(result)) {
    throw new Error(result.error?.message || 'Signing was rejected.')
  }
  const { publicKey, signature } = result as { publicKey: string; signature: string }
  if (!publicKey || !signature) throw new Error('Wallet did not return a signature.')
  return { publicKey, signature }
}

export async function sendNimTip(params: {
  creatorWalletAddress: string
  amountNim: number
  tipMessage?: string
  appName?: string
  appUrl: string
}): Promise<{ txHash: string | null; error?: string }> {
  const { creatorWalletAddress, amountNim, tipMessage } = params
  try {
    const nimiq = await getNimiq()
    const sender = await getSenderAddress()
    if (!sender) {
      return { txHash: null, error: 'No Nimiq account available' }
    }
    const value = Math.round(amountNim * 100000)
    const result = tipMessage
      ? await nimiq.sendBasicTransactionWithData({ recipient: creatorWalletAddress, value, data: tipMessage })
      : await nimiq.sendBasicTransaction({ recipient: creatorWalletAddress, value })
    if (isErrorResponse(result)) {
      return { txHash: null, error: result.error?.message || 'Transaction failed' }
    }
    if (typeof result === 'string') {
      // The Mini App SDK returns a serialized transaction. Older hosts may
      // return an already-broadcast hash, so support both contracts.
      const txHash = isSerializedTransaction(result)
        ? await broadcastSerializedTransaction(result)
        : result
      return { txHash }
    }
    if (result && typeof result === 'object') {
      const returned = result as Record<string, unknown>
      if (typeof returned.hash === 'string' && returned.hash) return { txHash: returned.hash }
      if (typeof returned.serializedTx === 'string' && returned.serializedTx) {
        return { txHash: await broadcastSerializedTransaction(returned.serializedTx) }
      }
    }
    return { txHash: null, error: 'Wallet did not return a transaction.' }
  } catch (err) {
    return { txHash: null, error: err instanceof Error ? err.message : 'Payment failed' }
  }
}
