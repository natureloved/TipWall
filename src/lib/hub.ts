// Desktop payment path for visitors outside Nimiq Pay (e.g. watching a stream
// on their PC): Nimiq Hub (hub.nimiq.com) pops up for account selection +
// signing, then TipWall broadcasts the signed transaction itself - Hub never
// touches the network.
import { normalizeAddress } from './profile-auth'

export const HUB_ENDPOINT = 'https://hub.nimiq.com'
const APP_NAME = 'TipWall'

export interface HubTipResult {
  txHash: string
  senderAddress: string
}

function friendlyHubError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (/cancel|connection was closed|closed by user/i.test(msg)) return new Error('Payment cancelled.')
  if (/popup|blocked/i.test(msg)) {
    return new Error('The wallet popup was blocked. Allow popups for this site and try again.')
  }
  return new Error(msg || 'The Nimiq Hub payment could not be completed.')
}

/**
 * Run a tip through Nimiq Hub's checkout popup. Resolves with the transaction
 * hash once TipWall has broadcast the signed transaction to the network.
 * Throws a user-presentable Error when the user cancels or something fails.
 */
export async function tipViaHub(params: {
  creatorHandle: string
  creatorDisplayName?: string
  creatorWalletAddress: string
  amountNim: number
  tipMessage?: string
}): Promise<HubTipResult> {
  let signed
  try {
    const { default: HubApi } = await import('@nimiq/hub-api')
    const api = new HubApi(HUB_ENDPOINT)
    signed = await api.checkout({
      appName: APP_NAME,
      recipient: params.creatorWalletAddress,
      value: Math.round(params.amountNim * 100000),
      fee: 0,
      extraData: params.tipMessage,
      // Hub derives validityStartHeight from the live chain itself; ten
      // minutes is ample time for the user to confirm.
      validityDuration: 600,
    })
  } catch (err) {
    throw friendlyHubError(err)
  }
  if (!signed || typeof (signed as { serializedTx?: string }).serializedTx !== 'string') {
    throw new Error('The wallet did not return a signed transaction.')
  }
  const { serializedTx, hash, raw } = signed as { serializedTx: string; hash: string; raw?: { sender?: string } }

  const res = await fetch('/api/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedTx }),
  })
  const data = await res.json().catch(() => ({})) as { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not broadcast the transaction. Please try again.')

  return {
    txHash: hash,
    senderAddress: raw?.sender ? normalizeAddress(raw.sender) : '',
  }
}
