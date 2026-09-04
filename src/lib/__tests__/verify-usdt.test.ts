import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyUsdtTxDetails } from '../verify-usdt'

const token = '0x1111111111111111111111111111111111111111'
const recipient = '0x2222222222222222222222222222222222222222'
const sender = '0x3333333333333333333333333333333333333333'
const padded = (address: string) => `0x${'0'.repeat(24)}${address.slice(2)}`

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('verifyUsdtTxDetails', () => {
  it('requires a successful mined receipt and matching Transfer log', async () => {
    vi.stubEnv('POLYGON_RPC_URL', 'https://polygon.test')
    vi.stubEnv('USDT_POLYGON_TOKEN_ADDRESS', token)
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { method: string }
      const result = body.method === 'eth_getTransactionByHash'
        ? { to: token, from: sender }
        : body.method === 'eth_getTransactionReceipt'
          ? { status: '0x1', blockNumber: '0x64', logs: [{ address: token, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef', padded(sender), padded(recipient)], data: '0x1e8480' }] }
          : '0x65'
      return new Response(JSON.stringify({ result }), { status: 200 })
    }))

    await expect(verifyUsdtTxDetails('0xabc', recipient, 2)).resolves.toEqual({ result: 'verified', senderAddress: sender })
  })

  it('rejects a receipt with a failed transaction', async () => {
    vi.stubEnv('POLYGON_RPC_URL', 'https://polygon.test')
    vi.stubEnv('USDT_POLYGON_TOKEN_ADDRESS', token)
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { method: string }
      const result = body.method === 'eth_getTransactionByHash' ? { to: token, from: sender } : body.method === 'eth_getTransactionReceipt' ? { status: '0x0', blockNumber: '0x64', logs: [] } : '0x65'
      return new Response(JSON.stringify({ result }), { status: 200 })
    }))

    await expect(verifyUsdtTxDetails('0xabc', recipient, 2)).resolves.toEqual({ result: 'unavailable' })
  })
})
