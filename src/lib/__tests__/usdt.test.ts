import { describe, expect, it, vi } from 'vitest'
import { buildUsdtPaymentLink, usdtToBaseUnits } from '../usdt'

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
})
