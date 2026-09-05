// Shared validation for profile create/edit payloads: reserved handles that
// would shadow app routes or invite impersonation, and length caps so an
// oversized field can't be stored and rendered verbatim.

export const HANDLE_MIN = 3
export const HANDLE_MAX = 32
export const DISPLAY_NAME_MAX = 50
export const BIO_MAX = 280
export const CONTENT_URL_MAX = 500
export const AVATAR_URL_MAX = 500
export const SOCIAL_URL_MAX = 500
export const POLYGON_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
export const ACHIEVEMENT_MAX = 80
export const GOAL_LABEL_MAX = 40
export const GOAL_TARGET_MIN = 1
export const GOAL_TARGET_MAX = 1_000_000_000

/** Handles that collide with app routes / static files or invite impersonation. */
const RESERVED_HANDLES = new Set([
  'api', 'claim', 'sitemap', 'robots', 'manifest', 'favicon',
  'dashboard', 'analytics', 'edit', 'admin', 'settings', 'login', 'signup',
  'static', 'assets', 'public', 'images', 'fonts',
  '_next', 'next', 'vercel', 'www', 'app', 'about', 'terms', 'privacy',
  'support', 'help', 'faq', 'new', 'create', 'official', 'tipwall', 'nimiq',
  'share', 'explore', 'badge', 'overlay', 'embed', 's',
])

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase())
}

/** Returns an error string for an invalid (already normalized) handle, else null. */
export function validateHandle(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `Handle must be at least ${HANDLE_MIN} characters`
  if (handle.length > HANDLE_MAX) return `Handle must be at most ${HANDLE_MAX} characters`
  if (isReservedHandle(handle)) return 'This handle is reserved'
  return null
}

/** Returns an error string for an invalid content URL, else null. Empty is fine. */
export function validateContentUrl(url: string): string | null {
  if (!url) return null
  if (url.length > CONTENT_URL_MAX) return 'Content URL is too long'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Content URL must be an http(s) link'
    }
  } catch {
    return 'Content URL is not a valid URL'
  }
  return null
}

/** Owner-private Telegram bot webhook: only Telegram's bot API is acceptable. */
export function validateNotifyTelegram(url: string): string | null {
  if (!url) return null
  if (url.length > 200) return 'Telegram webhook is too long'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.telegram.org' || !/^\/bot[^/]+\/sendMessage$/.test(parsed.pathname)) {
      return 'Must be a https://api.telegram.org/bot<TOKEN>/sendMessage URL'
    }
    if (!parsed.searchParams.get('chat_id')) return 'Telegram URL must include a chat_id query parameter'
  } catch {
    return 'Telegram webhook must be a valid HTTPS URL'
  }
  return null
}

/** Validate an EVM/Polygon payout address without accepting lookalike strings. */
export function validatePolygonAddress(address: string): string | null {
  if (!address) return null
  if (!POLYGON_ADDRESS_RE.test(address)) return 'USDT payout address must be a valid Polygon (0x…) address'
  return null
}

export const TAG_MAX = 3
export const TAG_LEN_MAX = 20

/** Normalize + validate creator tags: ≤3 unique non-empty tags of ≤20 chars. */
export function normalizeTags(input: unknown): { tags?: string[]; error?: string } {
  if (input === undefined) return {}
  if (!Array.isArray(input)) return { error: 'Tags must be a list' }
  const tags = [...new Set(
    input.map(t => String(t || '').trim().slice(0, TAG_LEN_MAX)).filter(Boolean),
  )]
  if (tags.length > TAG_MAX) return { error: `At most ${TAG_MAX} tags` }
  return { tags }
}

export interface GoalInput { label: string; targetNIM: number }

export const VALID_THEMES = new Set(['paper', 'mint', 'blush', 'sky', 'sun'])

export const VALID_CATEGORIES = new Set(['art', 'code', 'education', 'music', 'video', 'gaming', 'freelance', 'student', 'community'])

export const SOCIAL_LINK_KEYS = ['website', 'x', 'github', 'telegram', 'instagram', 'linkedin'] as const
export type SocialLinkKey = typeof SOCIAL_LINK_KEYS[number]

export function validatePublicUrl(url: string, label: string, maxLength = SOCIAL_URL_MAX): string | null {
  if (!url) return null
  if (url.length > maxLength) return `${label} is too long`
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return `${label} must be an http(s) link`
  } catch {
    return `${label} is not a valid URL`
  }
  return null
}

export function normalizeSocialLinks(input: unknown): { socialLinks?: Record<SocialLinkKey, string>; error?: string } {
  if (input === undefined) return {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Social links must be an object' }
  const raw = input as Record<string, unknown>
  const out = {} as Record<SocialLinkKey, string>
  for (const key of SOCIAL_LINK_KEYS) {
    const value = String(raw[key] || '').trim().slice(0, SOCIAL_URL_MAX)
    if (!value) continue
    const error = validatePublicUrl(value, `${key} link`)
    if (error) return { error }
    out[key] = value
  }
  return { socialLinks: Object.keys(out).length ? out : undefined }
}

/** Clamp/normalize the mutable presentation fields to their caps. */
export function clampProfileFields(fields: {
  displayName?: unknown
  bio?: unknown
  achievement?: unknown
  goal?: unknown
  theme?: unknown
  category?: unknown
  avatarUrl?: unknown
}): { displayName?: string; bio?: string; achievement?: string; goal?: GoalInput; theme?: string; category?: string; avatarUrl?: string } {
  const out: { displayName?: string; bio?: string; achievement?: string; goal?: GoalInput; theme?: string; category?: string; avatarUrl?: string } = {}
  if (fields.displayName !== undefined) {
    out.displayName = String(fields.displayName).slice(0, DISPLAY_NAME_MAX)
  }
  if (fields.bio !== undefined) {
    out.bio = String(fields.bio).slice(0, BIO_MAX)
  }
  if (fields.achievement !== undefined && fields.achievement) {
    out.achievement = String(fields.achievement).slice(0, ACHIEVEMENT_MAX)
  }
  if (fields.goal && typeof fields.goal === 'object') {
    const g = fields.goal as Record<string, unknown>
    const target = Number(g.targetNIM || 1000)
    out.goal = {
      label: String(g.label || 'Goal').slice(0, GOAL_LABEL_MAX),
      targetNIM: Math.min(GOAL_TARGET_MAX, Math.max(GOAL_TARGET_MIN, Number.isFinite(target) ? target : 1000)),
    }
  }
  if (fields.theme !== undefined) {
    const theme = String(fields.theme)
    out.theme = VALID_THEMES.has(theme) ? theme : 'paper'
  }
  if (fields.category !== undefined) {
    const category = String(fields.category)
    out.category = VALID_CATEGORIES.has(category) ? category : undefined
  }
  if (fields.avatarUrl !== undefined) out.avatarUrl = String(fields.avatarUrl || '').trim().slice(0, AVATAR_URL_MAX) || undefined
  return out
}
