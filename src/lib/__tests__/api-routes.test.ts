import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const kvMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  createClaim: vi.fn(),
  trackEvent: vi.fn(),
  checkRateLimit: vi.fn(),
  getTips: vi.fn(),
  getSupporters: vi.fn(),
  getVerifiedTotalNim: vi.fn(),
  consumeAuthNonce: vi.fn(),
  deleteTip: vi.fn(),
  setTipHidden: vi.fn(),
  transferProfileOwnership: vi.fn(),
}))

vi.mock('@/lib/kv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/kv')>()),
  ...kvMocks,
}))
vi.mock('@/lib/request', () => ({ getClientIp: () => 'test-client' }))
vi.mock('@/lib/verify-signature', () => ({
  verifyProfileAuth: (proof: { walletAddress: string }) => ({ ok: true, signerAddress: proof.walletAddress.replace(/\s+/g, '').toUpperCase() }),
}))

import { POST as createClaim } from '@/app/api/claim/create/route'
import { GET as detectTip } from '@/app/api/tips/detect/route'
import { GET as getPublicTips } from '@/app/api/tips/[handle]/route'
import { GET as getLiveTips } from '@/app/api/tips/[handle]/live/route'
import { POST as moderateTip } from '@/app/api/tips/[handle]/moderate/route'
import { POST as transferProfile } from '@/app/api/profile/[handle]/transfer/route'
import { GET as getWalletBalance } from '@/app/api/wallet/balance/route'

const PROFILE = {
  handle: 'alice',
  displayName: 'Alice',
  bio: '',
  contentUrl: '',
  walletAddress: 'NQ118VFNKLU86GK2DHMQYEK0Q6R1512X7HGE',
  ownerPublicKey: 'owner-key',
  createdAt: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  kvMocks.checkRateLimit.mockResolvedValue(true)
  kvMocks.getProfile.mockResolvedValue(PROFILE)
  kvMocks.getSupporters.mockResolvedValue([])
  kvMocks.getVerifiedTotalNim.mockResolvedValue(100)
  kvMocks.consumeAuthNonce.mockResolvedValue(true)
  kvMocks.setTipHidden.mockResolvedValue(true)
  kvMocks.deleteTip.mockResolvedValue(true)
  kvMocks.transferProfileOwnership.mockResolvedValue({ ...PROFILE })
})

afterEach(() => vi.unstubAllGlobals())

describe('claim route', () => {
  it('preserves the original message and reason for a sponsored handoff', async () => {
    const request = new NextRequest('https://tipwall.test/api/claim/create', {
      method: 'POST',
      body: JSON.stringify({ creatorHandle: 'alice', amountNIM: 10, message: 'Thanks!', reason: 'tutorial', source: 'redirect' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await createClaim(request)
    expect(response.status).toBe(200)
    expect(kvMocks.createClaim).toHaveBeenCalledWith(expect.objectContaining({ amountNIM: 10, message: 'Thanks!', reason: 'tutorial' }))
  })

  it('rejects the retired monthly pledge contract instead of storing unused reminder data', async () => {
    const request = new NextRequest('https://tipwall.test/api/claim/create', {
      method: 'POST',
      body: JSON.stringify({ creatorHandle: 'alice', amountNIM: 10, source: 'pledge', recurrence: 'monthly', email: 'fan@example.com' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await createClaim(request)
    expect(response.status).toBe(410)
    expect(kvMocks.createClaim).not.toHaveBeenCalled()
  })
})

describe('scan-to-pay detection', () => {
  it('falls back to recipient, amount, and freshness when the wallet drops the nonce message', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: [{
        hash: 'a'.repeat(64),
        to: PROFILE.walletAddress,
        value: 10_000_000,
        timestamp: Math.floor(Date.now() / 1000),
        data: '',
      }] }),
    })))
    const since = Date.now() - 60_000
    const response = await detectTip(new NextRequest(`https://tipwall.test/api/tips/detect?handle=alice&nonce=missing&amountNIM=100&since=${since}`))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ found: true, txHash: 'a'.repeat(64), amountNIM: 100 })
  })
})

describe('public tip route', () => {
  it('rejects an over-limit request before loading wall data', async () => {
    kvMocks.checkRateLimit.mockResolvedValueOnce(false)
    const response = await getPublicTips(new Request('https://tipwall.test/api/tips/alice'), { params: Promise.resolve({ handle: 'alice' }) })
    expect(response.status).toBe(429)
    expect(kvMocks.getProfile).not.toHaveBeenCalled()
  })

  it('keeps creator-hidden messages out of the public response', async () => {
    kvMocks.getTips.mockResolvedValue([
      { id: 'visible', handle: 'alice', senderAddress: 'NQ', amountNIM: 1, txHash: 'a', verified: true, anonymous: false, timestamp: 1, message: 'hello' },
      { id: 'hidden', handle: 'alice', senderAddress: 'NQ', amountNIM: 2, txHash: 'b', verified: true, anonymous: false, timestamp: 2, message: 'abuse', hiddenAt: 3 },
    ])
    const response = await getPublicTips(new Request('https://tipwall.test/api/tips/alice'), { params: Promise.resolve({ handle: 'alice' }) })
    const data = await response.json()
    expect(data.tips.map((tip: { id: string }) => tip.id)).toEqual(['visible'])
    expect(data.totalNIM).toBe(100)
  })
})

describe('live overlay route', () => {
  it('preserves USDT metadata for stream alerts', async () => {
    kvMocks.getTips.mockResolvedValue([
      { id: 'usdt-1', handle: 'alice', senderAddress: '0xsender', amountNIM: 0, amountUSDT: 5, asset: 'USDT', txHash: '0xhash', verified: true, anonymous: false, timestamp: 2, senderName: 'Sam' },
    ])
    const response = await getLiveTips(new NextRequest('https://tipwall.test/api/tips/alice/live'), { params: Promise.resolve({ handle: 'alice' }) })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ latest: { asset: 'USDT', amountUSDT: 5, senderName: 'Sam' } })
  })
})

describe('moderation route', () => {
  it('lets the signed owner hide a tip without deleting its payment record', async () => {
    const request = new Request('https://tipwall.test/api/tips/alice/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipId: 'tip-1',
        action: 'hide',
        auth: { action: 'update', handle: 'alice', walletAddress: PROFILE.walletAddress, publicKey: 'owner-key', signature: 'sig', issuedAt: Date.now() },
      }),
    })
    const response = await moderateTip(request, { params: Promise.resolve({ handle: 'alice' }) })
    expect(response.status).toBe(200)
    expect(kvMocks.setTipHidden).toHaveBeenCalledWith('alice', 'tip-1', true)
    expect(kvMocks.deleteTip).not.toHaveBeenCalled()
  })
})

describe('ownership transfer route', () => {
  it('requires and accepts signatures from both the current and destination wallets', async () => {
    const destination = 'NQ597VFNKLU86GK2DHMQYEK0Q6R1512X7HGE'
    const issuedAt = Date.now()
    const response = await transferProfile(new Request('https://tipwall.test/api/profile/alice/transfer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        newWalletAddress: destination,
        auth: { action: 'transfer', handle: 'alice', walletAddress: PROFILE.walletAddress, transferTo: destination, publicKey: 'owner-key', signature: 'owner-sig', issuedAt },
        newOwnerAuth: { action: 'transfer', handle: 'alice', walletAddress: destination, transferTo: destination, publicKey: 'new-key', signature: 'new-sig', issuedAt },
      }),
    }), { params: Promise.resolve({ handle: 'alice' }) })
    expect(response.status).toBe(200)
    expect(kvMocks.consumeAuthNonce).toHaveBeenCalledTimes(2)
    expect(kvMocks.transferProfileOwnership).toHaveBeenCalledWith(PROFILE, destination, 'new-key')
  })
})

describe('wallet balance route', () => {
  it('returns a read-only balance in luna and NIM', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: { balance: 250000 } }),
    })))
    const response = await getWalletBalance(new NextRequest(`https://tipwall.test/api/wallet/balance?address=${encodeURIComponent(PROFILE.walletAddress)}`))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ balanceLuna: 250000, balanceNIM: 2.5 })
  })

  it('tries the documented fallback when a configured relay returns null', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return {
        ok: true,
        json: async () => calls.length === 1
          ? { result: null }
          : { result: { balance: 250000 } },
      }
    }))
    const response = await getWalletBalance(new NextRequest(`https://tipwall.test/api/wallet/balance?address=${encodeURIComponent(PROFILE.walletAddress)}`))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ balanceNIM: 2.5 })
    expect(calls).toEqual(['https://rpc.test', 'https://api.nimiq.com'])
  })

  it('prefers a positive fallback result over a stale zero', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return {
        ok: true,
        json: async () => calls.length === 1
          ? { result: { balance: 0 } }
          : { result: { balance: 250000 } },
      }
    }))
    const response = await getWalletBalance(new NextRequest(`https://tipwall.test/api/wallet/balance?address=${encodeURIComponent(PROFILE.walletAddress)}`))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ balanceNIM: 2.5 })
    expect(calls).toEqual(['https://rpc.test', 'https://api.nimiq.com'])
  })

  it('does not turn an unresolved account into a false zero balance', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: null }),
    })))
    const response = await getWalletBalance(new NextRequest(`https://tipwall.test/api/wallet/balance?address=${encodeURIComponent(PROFILE.walletAddress)}`))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'NIM balance is temporarily unavailable' })
  })

  it('uses the account explorer when RPC relays cannot resolve a funded account', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'https://rpc.test')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).includes('/api/v1/account/')
        ? { balance: 750000 }
        : { result: null },
    })))
    const response = await getWalletBalance(new NextRequest(`https://tipwall.test/api/wallet/balance?address=${encodeURIComponent(PROFILE.walletAddress)}`))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ balanceLuna: 750000, balanceNIM: 7.5 })
  })

  it('rejects malformed addresses before contacting an upstream', async () => {
    const response = await getWalletBalance(new NextRequest('https://tipwall.test/api/wallet/balance?address=NQ00'))
    expect(response.status).toBe(400)
  })
})
