import { afterEach, describe, expect, it, vi } from 'vitest'

const sdkMocks = vi.hoisted(() => ({
  init: vi.fn(),
  requestDeviceIdentifier: vi.fn(),
}))

vi.mock('@nimiq/mini-app-sdk', () => sdkMocks)

import { extractAccountAddresses, sendNimTip } from '../nimiq'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Nimiq account extraction', () => {
  it('supports plain and wrapped provider account responses', () => {
    expect(extractAccountAddresses(['NQ one', 'NQ two'])).toEqual(['NQ one', 'NQ two'])
    expect(extractAccountAddresses({ result: { accounts: ['NQ one', 'NQ one'] } })).toEqual(['NQ one'])
  })
})

describe('NIM tip sending', () => {
  it('broadcasts the serialized transaction returned by the Mini App SDK', async () => {
    const sender = 'NQ one'
    const provider = {
      listAccounts: vi.fn().mockResolvedValue([sender]),
      sendBasicTransaction: vi.fn().mockResolvedValue('a'.repeat(220)),
    }
    sdkMocks.init.mockResolvedValue(provider)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hash: 'b'.repeat(64) }),
    }))

    const result = await sendNimTip({
      creatorWalletAddress: 'NQ creator',
      amountNim: 10,
      appUrl: 'https://tipwall.test',
    })

    expect(result).toEqual({ txHash: 'b'.repeat(64) })
    expect(provider.sendBasicTransaction).toHaveBeenCalledWith({ recipient: 'NQ creator', value: 1_000_000 })
    expect(fetch).toHaveBeenCalledWith('/api/broadcast', expect.objectContaining({ method: 'POST' }))
  })
})
