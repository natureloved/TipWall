import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { setChallenge } from '@/lib/kv'
import { buildAuthMessage, AuthAction } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * Issue a single-use challenge for a create/edit action. The client signs the
 * returned `message` with their Nimiq wallet and sends the signature + `nonce`
 * back to the create/edit endpoint, which validates and consumes it.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  const action: AuthAction = body.action === 'edit' ? 'edit' : 'create'
  const handle = String(body.handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!handle || handle.length < 3) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400 })
  }

  const nonce = randomUUID()
  await setChallenge(nonce, { handle, action })

  return NextResponse.json({ nonce, message: buildAuthMessage(action, handle, nonce) })
}
