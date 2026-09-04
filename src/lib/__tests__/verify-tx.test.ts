import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyTx, verifyTxDetails } from '../verify-tx'

const RECIPIENT = 'NQ48 8CKH BA24 2VR3 N249 N8MN J5XX 74DB U4JF'
const RECIPIENT_NORM = 'NQ488CKHBA242VR3N249N8MNJ5XX74DBU4JF'
const HASH = 'a'.repeat(64)
const AMOUNT_LUNA = 100 * 100000

function mockFetchOnce(payloads: Record<string, unknown>) {
  // Every fetch (RPC or explorer) resolves with the given JSON body.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => payloads,
  })))
}

beforeEach(() => {
  vi.stubEnv('NIMIQ_RPC_URL', '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('verifyTx', () => {
  it('verifies a tx whose recipient and amount match (explorer shape)', async () => {
    mockFetchOnce({ to_address: RECIPIENT_NORM, value: AMOUNT_LUNA, block_height: 123 })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('verified')
  })

  it('verifies a JSON-RPC envelope (result.data with `to`/`value`)', async () => {
    mockFetchOnce({ result: { data: { to: RECIPIENT_NORM, value: AMOUNT_LUNA, confirmations: 2 } } })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('verified')
  })

  it('returns the sender address from trusted chain data', async () => {
    const sender = 'NQ07000000000000000000000000000000000000'
    mockFetchOnce({ to: RECIPIENT_NORM, from: sender, value: AMOUNT_LUNA, blockHash: 'block-hash' })
    await expect(verifyTxDetails(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toEqual({
      result: 'verified',
      senderAddress: sender,
    })
  })

  it('accepts a small amount tolerance', async () => {
    mockFetchOnce({ to: RECIPIENT_NORM, value: AMOUNT_LUNA + 500, confirmations: 1 })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('verified')
  })

  it('reports a mismatch for the wrong recipient', async () => {
    mockFetchOnce({ to: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', value: AMOUNT_LUNA, blockHeight: 123 })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('mismatch')
  })

  it('reports a mismatch for the wrong amount', async () => {
    mockFetchOnce({ to: RECIPIENT_NORM, value: AMOUNT_LUNA * 2, blockHeight: 123 })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('mismatch')
  })

  it('does not verify a matching mempool transaction without block evidence', async () => {
    mockFetchOnce({ to: RECIPIENT_NORM, value: AMOUNT_LUNA, status: 'pending' })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('unavailable')
  })

  it('does not verify a transaction with zero confirmations', async () => {
    mockFetchOnce({ to: RECIPIENT_NORM, value: AMOUNT_LUNA, confirmations: 0 })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('unavailable')
  })

  it('reports unavailable when no source can resolve the tx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('unavailable')
  })

  it('reports unavailable when fetch throws (network down)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('unavailable')
  })

  it('treats an unrecognized payload shape as unavailable, not mismatch', async () => {
    mockFetchOnce({ something: 'else' })
    await expect(verifyTx(HASH, RECIPIENT, AMOUNT_LUNA, 1)).resolves.toBe('unavailable')
  })
})
