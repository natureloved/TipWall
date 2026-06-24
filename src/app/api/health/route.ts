import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET() {
  try {
    // Test KV connection
    await kv.set('health-check', 'ok', { ex: 10 })
    const result = await kv.get('health-check')
    
    if (result !== 'ok') {
      return NextResponse.json(
        { status: 'KV_READ_FAILED', message: 'Could not read from KV' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'OK',
      kv: 'connected',
      env: {
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN,
        urlPattern: process.env.KV_REST_API_URL?.substring(0, 20) + '***',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'ERROR',
        message: err.message,
        details: err.toString(),
      },
      { status: 500 }
    )
  }
}
