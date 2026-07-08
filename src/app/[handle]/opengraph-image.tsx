import { ImageResponse } from 'next/og'
import { getProfile, getVerifiedTotalNim } from '@/lib/kv'

// Social share card for a creator wall (rendered for og:image / twitter:image).
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'TipWall creator tipping wall'

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  let displayName = `@${handle}`
  let bio = ''
  let totalNIM = 0
  let goalLabel = ''
  let goalPercent: number | null = null
  try {
    const profile = await getProfile(handle)
    if (profile) {
      displayName = profile.displayName || `@${profile.handle}`
      bio = profile.bio || ''
      totalNIM = await getVerifiedTotalNim(handle)
      if (profile.goal?.targetNIM) {
        goalLabel = profile.goal.label || 'Goal'
        goalPercent = Math.min(100, Math.round((totalNIM / profile.goal.targetNIM) * 100))
      }
    }
  } catch {
    // KV unavailable — render the generic card.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>⚡</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#fbbf24' }}>TipWall</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: '#fde68a', lineHeight: 1.1 }}>
            {displayName.slice(0, 40)}
          </div>
          {bio ? (
            <div style={{ fontSize: 32, color: '#cbd5e1', maxWidth: 1000 }}>
              {bio.slice(0, 110)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 26, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>
              NIM tipped
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#fbbf24' }}>
              {Math.round(totalNIM).toLocaleString('en-US')} NIM
            </div>
          </div>
          {goalPercent !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ fontSize: 26, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>
                {goalLabel.slice(0, 30)}
              </div>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#34d399' }}>{goalPercent}%</div>
            </div>
          ) : (
            <div style={{ fontSize: 30, color: '#94a3b8' }}>Tip the creator. Not the platform.</div>
          )}
        </div>
      </div>
    ),
    size,
  )
}
