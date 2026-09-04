import { describe, expect, it } from 'vitest'
import { parseBalanceLuna } from '../nimiq-balance'

describe('NIM balance parsing', () => {
  it('parses a JSON-RPC account result', () => {
    expect(parseBalanceLuna({ result: { address: 'NQ', balance: 123456 } })).toBe(123456)
  })

  it('accepts string balances and treats malformed payloads as unavailable', () => {
    expect(parseBalanceLuna({ data: { balance: '0' } })).toBe(0)
    expect(parseBalanceLuna({ result: { error: 'offline' } })).toBeNull()
  })
})
