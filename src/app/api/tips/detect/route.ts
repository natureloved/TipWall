import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'
import { messageHasNonce } from '@/lib/pay-request'

/**
 * Poll nimiqwatch for an incoming transaction to a creator's wallet that
 * carries a specific attribution nonce in its extra_data / message field.
 * Called repeatedly by the scan-to-pay QR flow until the payment is found.
 *
 * GET /api/tips/detect?handle=<handle>&nonce=<nonce>&amountNIM=<n>
 *
 * Returns { found: false } while waiting, or
 *         { found: true, txHash, senderAddress, amountNIM } when matched.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const handle = normalizeHandle(searchParams.get('handle') || '')
  const nonce = (searchParams.get('nonce') || '').trim()
  const amountNIM = Number(searchParams.get('amountNIM'))

  if (!handle || !nonce || !amountNIM) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const profile = await getProfile(handle)
  if (!profile) return NextResponse.json({ error: 'creator not found' }, { status: 404 })

  const address = profile.walletAddress.replace(/ /g, '')
  const amountLuna = Math.round(amountNIM * 100_000)

  try {
    // nimiqwatch REST: last 25 incoming txs for this address
    const resp = await fetch(
      `https://v2.nimiqwatch.com/api/v1/account/${encodeURIComponent(address)}/transactions?limit=25`,
      { headers: { 'User-Agent': 'TipWall/1.0' }, next: { revalidate: 0 } },
    )
    if (!resp.ok) return NextResponse.json({ found: false })

    const data = await resp.json()
    const txs: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.transactions)
        ? data.transactions
        : Array.isArray(data?.data)
          ? data.data
          : []

    for (const raw of txs) {
      const tx = raw as Record<string, unknown>
      const value = Number(tx.value ?? tx.amount ?? tx.luna ?? 0)
      const msg: string = String(tx.data ?? tx.message ?? tx.extraData ?? tx.extra_data ?? '')
      const sender: string = String(tx.fromAddress ?? tx.from ?? tx.from_address ?? tx.senderAddress ?? '')

      // Amount must be within 1000 luna (fee tolerance) and nonce must match
      if (Math.abs(value - amountLuna) > 1000) continue
      if (!messageHasNonce(msg, nonce)) continue

      return NextResponse.json({
        found: true,
        txHash: String(tx.hash ?? tx.transactionHash ?? tx.id ?? ''),
        senderAddress: sender,
        amountNIM,
      })
    }
  } catch {
    // Explorer down — caller will retry
  }

  return NextResponse.json({ found: false })
}
