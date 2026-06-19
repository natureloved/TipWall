import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'
import {
  buildProfileAuthMessage,
  normalizeAddress,
  type ProfileAuthAction,
  type ProfileAuthProof,
} from './profile-auth'

let nimiqCache: { senderAddress: string | null; deviceId: string | null } | null = null

export async function initNimiq() {
  if (nimiqCache) return nimiqCache
  try {
    const nimiq = await init()
    const accounts = await nimiq.listAccounts()
    const senderAddress = Array.isArray(accounts) ? accounts[0] : null
    let deviceId: string | null = null
    try {
      const id = await requestDeviceIdentifier({ reason: 'Prevent tip spam and rate limiting' })
      deviceId = id || null
    } catch { }
    nimiqCache = { senderAddress, deviceId }
    return nimiqCache
  } catch (err) {
    nimiqCache = { senderAddress: null, deviceId: null }
    return nimiqCache
  }
}

export async function getSenderAddress(): Promise<string | null> {
  if (nimiqCache?.senderAddress) return nimiqCache.senderAddress
  try {
    const nimiq = await init()
    const accounts = await nimiq.listAccounts()
    return Array.isArray(accounts) ? accounts[0] : null
  } catch {
    return null
  }
}

/** Helper to read either { error } responses or plain values from the SDK. */
function isErrorResponse(v: unknown): v is { error: { message?: string } } {
  return typeof v === 'object' && v !== null && 'error' in v
}

/**
 * Connect the in-app Nimiq wallet and return the user's first account address.
 * Throws a friendly error when not running inside Nimiq Pay.
 */
export async function connectWallet(): Promise<string> {
  let nimiq
  try {
    nimiq = await init()
  } catch {
    throw new Error('Open this app inside Nimiq Pay to connect your wallet.')
  }
  const accounts = await nimiq.listAccounts()
  if (isErrorResponse(accounts)) {
    throw new Error(accounts.error?.message || 'Could not list wallet accounts.')
  }
  const address = Array.isArray(accounts) ? accounts[0] : null
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
}): Promise<ProfileAuthProof> {
  const nimiq = await init()
  const walletAddress = normalizeAddress(params.walletAddress)
  const issuedAt = Date.now()
  const message = buildProfileAuthMessage({
    action: params.action,
    handle: params.handle,
    walletAddress,
    issuedAt,
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
    publicKey,
    signature,
  }
}

export async function sendNimTip(params: {
  creatorWalletAddress: string
  amountNim: number
  tipMessage?: string
  appName?: string
  appUrl: string
}): Promise<{ txHash: string | null; error?: string }> {
  const { creatorWalletAddress, amountNim, tipMessage, appName = 'TipWall', appUrl } = params
  try {
    const HubApi = (await import('@nimiq/hub-api')).default
    const hubApi = new HubApi('https://hub.nimiq.com')
    const signedTx = await hubApi.checkout({
      appName,
      recipient: creatorWalletAddress,
      value: Math.round(amountNim * 100000),
      extraData: tipMessage || undefined,
      shopLogoUrl: `${appUrl}/logo.png`,
    })
    return { txHash: signedTx.hash || null }
  } catch (err: any) {
    return { txHash: null, error: err?.message || 'Payment failed' }
  }
}
