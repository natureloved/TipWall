import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'

let nimiqCache: { senderAddress: string | null; deviceId: string | null } | null = null

export async function initNimiq() {
  // Return cached result to prevent multiple initializations
  if (nimiqCache) return nimiqCache
  try {
    const nimiq = await init()
    const accounts = await nimiq.listAccounts()
    const senderAddress = Array.isArray(accounts) ? (accounts as any[])[0]?.address || null : null
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
