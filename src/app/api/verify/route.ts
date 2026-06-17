import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { txHash } = body
  if (!txHash) return NextResponse.json({ error: 'txHash required' }, { status: 400 })
  const resp = await fetch(`https://api.nimiq.com/transactions/${txHash}`)
  const data = await resp.json()
  return NextResponse.json({ valid: !!data?.valid, data })
}
