import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTelegramTipNotification } from '../telegram'
import type { CreatorProfile, Tip } from '../types'

const profile: CreatorProfile = {
  handle: 'alice',
  displayName: 'Alice',
  bio: '',
  contentUrl: '',
  walletAddress: 'NQ488CKHBA242VR3N249N8MNJ5XX74DBU4JF',
  notifyTelegram: 'https://api.telegram.org/bot123:secret/sendMessage?chat_id=456',
  createdAt: 1,
}

const tip: Tip = {
  id: 'tip-1',
  handle: 'alice',
  senderAddress: 'NQ',
  senderName: 'Sam',
  amountNIM: 12,
  txHash: 'hash',
  verified: true,
  anonymous: false,
  timestamp: Date.now(),
  message: 'Thanks!',
}

afterEach(() => vi.unstubAllGlobals())

describe('Telegram tip notifications', () => {
  it('awaits Telegram acceptance and sends chat_id plus text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendTelegramTipNotification(profile, tip)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(profile.notifyTelegram, expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({ chat_id: '456', text: expect.stringContaining('12 NIM') })
  })

  it('reports Telegram API failures without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false }) }))
    await expect(sendTelegramTipNotification(profile, tip)).resolves.toBe(false)
  })

  it('rejects an endpoint without a chat id before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendTelegramTipNotification({ ...profile, notifyTelegram: 'https://api.telegram.org/bot123:secret/sendMessage' }, tip)).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
