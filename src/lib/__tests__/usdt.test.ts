import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildUsdtPaymentLink,
  getEvmAddress,
  getUsdtBalance,
  sendUsdtTip,
  usdtPaymentsConfigured,
  usdtToBaseUnits,
} from '../usdt'

const TOKEN = '0x1111111111111111111111111111111111111111'
const RECIPIENT = '0x2222222222222222222222222222222222222222'
const SENDER = '0x3333333333333333333333333333333333333333'

/**
 * Install a fake EIP-1193 provider (the shape Nimiq Pay injects) and return the
 * ordered log of methods it was asked for. Any unexpected method throws, so a
 * test fails loudly if the integration starts calling something new.
 */
function stubProvider(handlers: Record<string, (params?: unknown[]) => unknown>) {
  const calls: string[] = []
  vi.stubGlobal('window', {
    ethereum: {
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        calls.push(method)
        const handler = handlers[method]
        if (!handler) throw new Error(`unexpected method ${method}`)
        return handler(params)
      },
    },
  })
  return calls
}

function hexQuantity(value: number): string {
  return `0x${value.toString(16).padStart(64, '0')}`
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('USDT helpers', () => {
  it('converts decimal USDT to six-decimal base units', () => {
    expect(usdtToBaseUnits(1.25)).toBe(BigInt(1_250_000))
  })

  it('builds an EIP-681 Polygon token transfer request', () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', '0x1111111111111111111111111111111111111111')
    expect(buildUsdtPaymentLink({ recipient: '0x2222222222222222222222222222222222222222', amountUSDT: 2 })).toBe(
      'ethereum:0x1111111111111111111111111111111111111111@137/transfer?address=0x2222222222222222222222222222222222222222&uint256=2000000',
    )
  })

  it('accepts a token address resolved from the server at runtime', () => {
    expect(usdtPaymentsConfigured('0x2222222222222222222222222222222222222222', '0x1111111111111111111111111111111111111111')).toBe(true)
  })
})

describe('getEvmAddress', () => {
  it('reads the connected account without prompting the user', async () => {
    const calls = stubProvider({ eth_accounts: () => [SENDER] })
    await expect(getEvmAddress()).resolves.toBe(SENDER)
    // eth_accounts is the passive read; eth_requestAccounts would prompt.
    expect(calls).toEqual(['eth_accounts'])
  })

  it('returns null when the host exposes no EVM provider', async () => {
    vi.stubGlobal('window', {})
    await expect(getEvmAddress()).resolves.toBeNull()
  })
})

describe('getUsdtBalance', () => {
  it('decodes a balanceOf eth_call result', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', TOKEN)
    const calls = stubProvider({ eth_call: () => hexQuantity(12_500_000) })
    await expect(getUsdtBalance({ owner: SENDER })).resolves.toBe(12.5)
    expect(calls).toEqual(['eth_call'])
  })

  it('returns null instead of throwing when the RPC call fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', TOKEN)
    stubProvider({ eth_call: () => { throw new Error('rpc down') } })
    await expect(getUsdtBalance({ owner: SENDER })).resolves.toBeNull()
  })

  it('skips the call when the token address is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', '')
    const calls = stubProvider({})
    await expect(getUsdtBalance({ owner: SENDER })).resolves.toBeNull()
    expect(calls).toEqual([])
  })
})

describe('sendUsdtTip', () => {
  it('switches to Polygon and sends the encoded transfer', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', TOKEN)
    const calls = stubProvider({
      eth_chainId: () => '0x89',
      eth_requestAccounts: () => [SENDER],
      eth_sendTransaction: () => '0xhash',
    })
    await expect(sendUsdtTip({ recipient: RECIPIENT, amountUSDT: 5 })).resolves.toEqual({
      txHash: '0xhash',
      senderAddress: SENDER,
    })
    expect(calls).toEqual(['eth_chainId', 'eth_requestAccounts', 'eth_sendTransaction'])
  })

  it('adds the chain when the wallet reports 4902, then sends', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', TOKEN)
    const calls = stubProvider({
      eth_chainId: () => '0x1',
      wallet_switchEthereumChain: () => { throw { code: 4902 } },
      wallet_addEthereumChain: () => null,
      eth_requestAccounts: () => [SENDER],
      eth_sendTransaction: () => '0xhash',
    })
    await expect(sendUsdtTip({ recipient: RECIPIENT, amountUSDT: 5 })).resolves.toMatchObject({ txHash: '0xhash' })
    expect(calls).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'eth_requestAccounts',
      'eth_sendTransaction',
    ])
  })

  it('surfaces a switch failure that is not 4902', async () => {
    vi.stubEnv('NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS', TOKEN)
    stubProvider({
      eth_chainId: () => '0x1',
      wallet_switchEthereumChain: () => { throw { code: 4001 } },
    })
    await expect(sendUsdtTip({ recipient: RECIPIENT, amountUSDT: 5 })).rejects.toThrow(/Switch your wallet to Polygon/)
  })
})
