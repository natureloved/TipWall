import { NextResponse } from 'next/server'
import { getOgMetadata } from '@/lib/kv'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
  const meta = await getOgMetadata(url)
  if (!meta) return NextResponse.json({ error: 'failed to fetch' }, { status: 500 })
  return NextResponse.json(meta)
}
