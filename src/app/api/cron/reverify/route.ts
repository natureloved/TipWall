import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getRegisteredHandles, reverifyPendingTips } from '@/lib/kv'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Scheduled pending-tip reconciliation. Vercel sends the CRON_SECRET as a
 * bearer token; non-Vercel deployments can invoke the same endpoint from their
 * scheduler with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'cron is not configured' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const handles = await getRegisteredHandles()
    let checked = 0
    let failed = 0
    for (const handle of handles) {
      const profile = await getProfile(handle)
      if (!profile) continue
      try {
        await reverifyPendingTips(handle, profile.walletAddress)
        checked++
      } catch {
        // One broken wall must not prevent the rest of the registry from being
        // reconciled on the next scheduled run.
        failed++
      }
    }
    return NextResponse.json({ ok: true, walls: handles.length, checked, failed })
  } catch (err) {
    logError('pending_tip_reconciliation_failed', err)
    return NextResponse.json({ error: 'reconciliation failed' }, { status: 500 })
  }
}
