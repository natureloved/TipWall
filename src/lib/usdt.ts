import { validatePolygonAddress } from './validate-profile'

/**
 * USDT on Polygon through the Nimiq Pay mini-app EVM provider.
 *
 * Nimiq Pay injects a standard EIP-1193 provider at `window.ethereum`; the same
 * wallet address is reused across every EVM chain, so nothing here is Polygon
 * specific beyond the chain id and the token contract. See:
 * https://nimiq.dev/mini-apps/features/evm-tokens
 */

/** Polygon PoS uses six decimal places for USDT. */
export const USDT_DECIMALS = 6
export const POLYGON_CHAIN_ID = '0x89'

/** ERC-20 `balanceOf(address)` selector. */
const BALANCE_OF_SELECTOR = '0x70a08231'
/** ERC-20 `transfer(address,uint256)` selector. */
const TRANSFER_SELECTOR = '0xa9059cbb'

/**
 * `wallet_switchEthereumChain` fails with this code when the wallet has no
 * configuration for the chain. The documented recovery is
 * `wallet_addEthereumChain`, not an error message.
 */
const UNKNOWN_CHAIN_CODE = 4902

/**
 * Parameters for `wallet_addEthereumChain`. Values come from the Polygon docs;
 * the RPC entry is only a fallback the host may never use.
 */
export const POLYGON_CHAIN_PARAMS = {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon',
  rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  blockExplorerUrls: ['https://polygonscan.com'],
}

/** The token contract is supplied at build/deploy time to avoid hard-coding a chain asset. */
export function usdtTokenAddress(): string {
  const value = (process.env.NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS || '').trim()
  return validatePolygonAddress(value) ? '' : value
}

export function usdtPaymentsConfigured(recipient?: string, tokenAddress?: string): boolean {
  const token = tokenAddress || usdtTokenAddress()
  return Boolean(recipient && !validatePolygonAddress(recipient) && token && !validatePolygonAddress(token))
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

function leftPad32(value: string): string {
  return value.toLowerCase().replace(/^0x/, '').padStart(64, '0')
}

function transferData(recipient: string, amount: bigint): string {
  return `${TRANSFER_SELECTOR}${leftPad32(recipient)}${amount.toString(16).padStart(64, '0')}`
}

function balanceOfData(owner: string): string {
  return `${BALANCE_OF_SELECTOR}${leftPad32(owner)}`
}

/** Read an EIP-1193 error code, including the nested `data.originalError` shape. */
function errorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const record = error as Record<string, unknown>
  const direct = record.code
  if (typeof direct === 'number') return direct
  if (typeof direct === 'string' && /^\d+$/.test(direct)) return Number(direct)
  const data = record.data
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>).originalError
    if (nested && typeof nested === 'object') {
      const nestedCode = (nested as Record<string, unknown>).code
      if (typeof nestedCode === 'number') return nestedCode
      if (typeof nestedCode === 'string' && /^\d+$/.test(nestedCode)) return Number(nestedCode)
    }
  }
  return null
}

/**
 * Ensure the wallet is on Polygon before a token call. A wallet that has never
 * seen the chain returns 4902 from `wallet_switchEthereumChain`, so we add it
 * and continue rather than dead-ending the supporter.
 */
async function ensurePolygonChain(provider: EthereumProvider): Promise<void> {
  const chainId = String(await provider.request({ method: 'eth_chainId' })).toLowerCase()
  if (chainId === POLYGON_CHAIN_ID) return
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID }],
    })
  } catch (error) {
    if (errorCode(error) !== UNKNOWN_CHAIN_CODE) {
      throw new Error('Switch your wallet to Polygon to send USDT.')
    }
    // Adding the chain also switches to it, so no second switch is needed.
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [POLYGON_CHAIN_PARAMS],
    })
  }
}

/**
 * Read the already-connected EVM account without prompting the user.
 * `eth_accounts` needs no confirmation, unlike `eth_requestAccounts`, so this
 * is safe for a passive balance read.
 */
export async function getEvmAddress(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) return null
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    const address = Array.isArray(accounts) ? String(accounts[0] || '') : ''
    return address && !validatePolygonAddress(address) ? address : null
  } catch {
    return null
  }
}

/**
 * Read the connected wallet's USDT balance with a read-only `eth_call`
 * (no user confirmation). Returns null when the provider or config is
 * unavailable so the caller can simply hide the balance line.
 */
export async function getUsdtBalance(params: { tokenAddress?: string; owner: string }): Promise<number | null> {
  if (typeof window === 'undefined' || !window.ethereum) return null
  const token = params.tokenAddress || usdtTokenAddress()
  if (!token || validatePolygonAddress(token) || validatePolygonAddress(params.owner)) return null
  try {
    const raw = await window.ethereum.request({
      method: 'eth_call',
      params: [{ to: token, data: balanceOfData(params.owner) }, 'latest'],
    })
    const value = BigInt(String(raw || '0x0'))
    return Number(formatBaseUnits(value))
  } catch {
    return null
  }
}

/** Send a direct USDT transfer through the injected Nimiq Pay EVM provider. */
export async function sendUsdtTip(params: { tokenAddress?: string; recipient: string; amountUSDT: number }): Promise<{ txHash: string; senderAddress: string }> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No browser wallet found. Scan the payment code or open this page in your wallet.')
  }
  const token = params.tokenAddress || usdtTokenAddress()
  if (!token || validatePolygonAddress(token)) throw new Error('USDT payments are not configured yet.')
  if (validatePolygonAddress(params.recipient)) throw new Error('Invalid USDT recipient')
  await ensurePolygonChain(window.ethereum)
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
