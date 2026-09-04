import { validatePolygonAddress } from './validate-profile'

/** Polygon PoS uses six decimal places for USDT. */
export const USDT_DECIMALS = 6
export const POLYGON_CHAIN_ID = '0x89'

/** The token contract is supplied at build/deploy time to avoid hard-coding a chain asset. */
export function usdtTokenAddress(): string {
  const value = (process.env.NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS || '').trim()
  return validatePolygonAddress(value) ? '' : value
}

export function usdtPaymentsConfigured(recipient?: string): boolean {
  return Boolean(recipient && !validatePolygonAddress(recipient) && usdtTokenAddress())
}

export function usdtToBaseUnits(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid USDT amount')
  const scaled = Math.round(amount * 10 ** USDT_DECIMALS)
  if (!Number.isSafeInteger(scaled) || scaled <= 0) throw new Error('USDT amount is too large')
  return BigInt(scaled)
}

export function formatBaseUnits(value: bigint): string {
  const raw = value.toString().padStart(USDT_DECIMALS + 1, '0')
  const split = raw.length - USDT_DECIMALS
  return `${raw.slice(0, split)}.${raw.slice(split)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

/** EIP-681 link understood by MetaMask and other Polygon wallets. */
export function buildUsdtPaymentLink(params: { tokenAddress?: string; recipient: string; amountUSDT: number }): string {
  const token = params.tokenAddress || usdtTokenAddress()
  if (!token || validatePolygonAddress(token)) throw new Error('USDT token configuration is missing')
  if (validatePolygonAddress(params.recipient)) throw new Error('Invalid USDT recipient')
  const units = usdtToBaseUnits(params.amountUSDT)
  return `ethereum:${token}@137/transfer?address=${params.recipient}&uint256=${units.toString()}`
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

declare global {
  interface Window { ethereum?: EthereumProvider }
}

function transferData(recipient: string, amount: bigint): string {
  return `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`
}

/** Send a direct USDT transfer through an injected Polygon wallet. */
export async function sendUsdtTip(params: { tokenAddress?: string; recipient: string; amountUSDT: number }): Promise<{ txHash: string; senderAddress: string }> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No browser wallet found. Scan the payment code or open this page in your wallet.')
  }
  const token = params.tokenAddress || usdtTokenAddress()
  if (!token || validatePolygonAddress(token)) throw new Error('USDT payments are not configured yet.')
  if (validatePolygonAddress(params.recipient)) throw new Error('Invalid USDT recipient')
  const chainId = String(await window.ethereum.request({ method: 'eth_chainId' }))
  if (chainId.toLowerCase() !== POLYGON_CHAIN_ID) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: POLYGON_CHAIN_ID }] })
    } catch {
      throw new Error('Switch your wallet to Polygon to send USDT.')
    }
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const sender = Array.isArray(accounts) ? String(accounts[0] || '') : ''
  if (!sender) throw new Error('No Polygon wallet account selected.')
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from: sender, to: token, value: '0x0', data: transferData(params.recipient, usdtToBaseUnits(params.amountUSDT)) }],
  })
  if (typeof txHash !== 'string' || !txHash) throw new Error('The wallet did not return a transaction hash.')
  return { txHash, senderAddress: sender }
}
