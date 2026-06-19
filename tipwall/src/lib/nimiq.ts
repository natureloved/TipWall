import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'

let nimiqPromise: ReturnType<typeof init> | null = null

function getNimiq(): ReturnType<typeof init> {
  if (!nimiqPromise) {
    nimiqPromise = init({ timeout: 10_000 })
  }
  return nimiqPromise
}

let cachedSenderAddress: string | null = null
let cachedDeviceId: string | null = null

export async function ensureInitialized() {
  const nimiq = await getNimiq()
  cachedSenderAddress = null
  cachedDeviceId = null
  return nimiq
}

export async function initNimiq() {
  try {
    const nimiq = await getNimiq()
    if (cachedSenderAddress === null) {
      const accounts = await nimiq.listAccounts()
      cachedSenderAddress = Array.isArray(accounts) ? accounts[0] : null
      try {
        cachedDeviceId = (await requestDeviceIdentifier({ reason: 'Prevent tip spam and rate limiting' })) || null
      } catch { }
    }
    return { senderAddress: cachedSenderAddress, deviceId: cachedDeviceId }
  } catch {
    return { senderAddress: null, deviceId: null }
  }
}

export async function getSenderAddress(): Promise<string | null> {
  if (cachedSenderAddress) return cachedSenderAddress
  try {
    const nimiq = await getNimiq()
    const accounts = await nimiq.listAccounts()
    cachedSenderAddress = Array.isArray(accounts) ? accounts[0] : null
    return cachedSenderAddress
  } catch {
    return null
  }
}

export async function isConsensusEstablished(): Promise<boolean | null> {
  try {
    const nimiq = await getNimiq()
    return await nimiq.isConsensusEstablished()
  } catch {
    return null
  }
}

export async function getBlockNumber(): Promise<number | null> {
  try {
    const nimiq = await getNimiq()
    return await nimiq.getBlockNumber()
  } catch {
    return null
  }
}

export async function signMessage(message: string): Promise<{ publicKey: string; signature: string; address: string }> {
  const nimiq = await getNimiq()

  const accounts = await nimiq.listAccounts()
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error('No Nimiq wallet connected')
  }
  const address = accounts[0]

  const result = await nimiq.sign(message)
  if (!result || 'error' in result) {
    throw new Error((result as any)?.error?.message || 'Signing was cancelled or failed')
  }

  cachedSenderAddress = address
  return { publicKey: result.publicKey, signature: result.signature, address }
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
