import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

/**
 * Liveness check. Intentionally terse: no env values, URLs, or error internals
 * are exposed — this endpoint is public.
 */
export async function GET() {
  try {
    await kv.set('health-check', 'ok', { ex: 10 })
    const result = await kv.get('health-check')
    if (result !== 'ok') {
      return NextResponse.json({ status: 'ERROR' }, { status: 500 })
    }
    return NextResponse.json({ status: 'OK' })
  } catch {
    return NextResponse.json({ status: 'ERROR' }, { status: 500 })
  }
}
