// Shared validation for profile create/edit payloads: reserved handles that
// would shadow app routes or invite impersonation, and length caps so an
// oversized field can't be stored and rendered verbatim.

export const HANDLE_MIN = 3
export const HANDLE_MAX = 32
export const DISPLAY_NAME_MAX = 50
export const BIO_MAX = 280
export const CONTENT_URL_MAX = 500
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
  'support', 'help', 'new', 'create', 'official', 'tipwall', 'nimiq',
  'share', 'explore', 'badge',
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

export interface GoalInput { label: string; targetNIM: number }

/** Clamp/normalize the mutable presentation fields to their caps. */
export function clampProfileFields(fields: {
  displayName?: unknown
  bio?: unknown
  achievement?: unknown
  goal?: unknown
}): { displayName?: string; bio?: string; achievement?: string; goal?: GoalInput } {
  const out: { displayName?: string; bio?: string; achievement?: string; goal?: GoalInput } = {}
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
  return out
}
