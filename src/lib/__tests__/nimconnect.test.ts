import { describe, expect, it, vi } from 'vitest'
import { enrichSupportersWithNimConnectHandles } from '../nimconnect'
import type { Supporter } from '../types'

const supporters: Supporter[] = [
  {
    address: 'NQ10 A2ET 9A6X 1J5S 28MM 4JHG NEAX XRDA 47JX',
    totalNIM: 250,
    tipCount: 2,
    firstTipAt: 1,
  },
  {
    address: 'NQ48 8CKH BA24 2VR3 N249 N8MN J5XX 74DB U4JF',
    totalNIM: 100,
    tipCount: 1,
    firstTipAt: 2,
  },
]

describe('enrichSupportersWithNimConnectHandles', () => {
  it('adds the current NimConnect handle without changing supporter data', async () => {
    const resolve = vi.fn(async (address: string) => (
      address === supporters[0].address ? { handle: 'chuck' } : null
    ))

    await expect(enrichSupportersWithNimConnectHandles(supporters, resolve)).resolves.toEqual([
      { ...supporters[0], nimConnectHandle: 'chuck' },
      supporters[1],
    ])
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('keeps the address fallback when an address has no handle', async () => {
    const resolve = vi.fn(async () => null)

    await expect(enrichSupportersWithNimConnectHandles(supporters, resolve)).resolves.toEqual(supporters)
  })

  it('keeps the address fallback when a NimConnect lookup fails', async () => {
    const resolve = vi.fn(async () => {
      throw new Error('NimConnect unavailable')
    })

    await expect(enrichSupportersWithNimConnectHandles(supporters, resolve)).resolves.toEqual(supporters)
  })

  it('limits lookups to the twelve featured supporters', async () => {
    const manySupporters = Array.from({ length: 13 }, (_, index): Supporter => ({
      address: `NQ${String(index).padStart(2, '0')}`,
      totalNIM: 13 - index,
      tipCount: 1,
      firstTipAt: index,
    }))
    const resolve = vi.fn(async () => ({ handle: 'supporter' }))

    const result = await enrichSupportersWithNimConnectHandles(manySupporters, resolve)

    expect(resolve).toHaveBeenCalledTimes(12)
    expect(result[11].nimConnectHandle).toBe('supporter')
    expect(result[12]).toEqual(manySupporters[12])
  })
})
