import { describe, it, expect } from 'vitest'
import { sanitizeTips } from '../kv'
import type { Tip } from '../types'

const base: Tip = {
  id: 't1',
  handle: 'alice',
  senderAddress: 'NQ12 3456 7890 ABCD',
  senderName: 'Alex',
  amountNIM: 10,
  txHash: 'x'.repeat(64),
  verified: true,
  anonymous: false,
  timestamp: 1,
}

describe('sanitizeTips', () => {
  it('keeps identity for named tips', () => {
    const [tip] = sanitizeTips([base])
    expect(tip.senderAddress).toBe(base.senderAddress)
    expect(tip.senderName).toBe('Alex')
  })

  it('strips address AND self-reported name for anonymous tips', () => {
    const [tip] = sanitizeTips([{ ...base, anonymous: true }])
    expect(tip.senderAddress).toBe('')
    expect(tip.senderName).toBeUndefined()
  })
})
