import type { CreatorProfile, Tip } from './types'
import { log } from './logger'

/**
 * Deliver a creator's tip alert through the owner-configured Telegram Bot API
 * sendMessage URL. The token is never included in logs or error responses.
 */
export async function sendTelegramTipNotification(profile: CreatorProfile, tip: Tip): Promise<boolean> {
  const endpoint = profile.notifyTelegram?.trim()
  if (!endpoint) return false

  let parsed: URL
  let chatId: string | null
  try {
    parsed = new URL(endpoint)
    chatId = parsed.searchParams.get('chat_id')
  } catch {
    chatId = null
  }
  if (!chatId) {
    log('warn', 'telegram_notification_invalid_config', { handle: profile.handle })
    return false
  }

  const who = tip.anonymous ? 'Someone' : tip.senderName || 'A supporter'
  const amount = tip.asset === 'USDT' ? `${tip.amountUSDT || 0} USDT` : `${tip.amountNIM} NIM`
  const text = `💸 ${who} tipped you ${amount}${tip.message ? ` — “${tip.message}”` : ''}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(5000),
    })
    const payload = await response.json().catch(() => null) as { ok?: unknown } | null
    if (!response.ok || payload?.ok === false) {
      log('warn', 'telegram_notification_failed', { handle: profile.handle, status: response.status })
      return false
    }
    return true
  } catch (error) {
    log('warn', 'telegram_notification_unavailable', {
      handle: profile.handle,
      error: error instanceof Error ? error.name : 'unknown_error',
    })
    return false
  }
}
