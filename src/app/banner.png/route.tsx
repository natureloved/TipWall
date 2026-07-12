import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Stable banner asset for listings and submissions (mini-app directories,
// competition forms, social cards): https://<host>/banner.png — 1200x630 PNG
// composed from the real logo so it never drifts from the icon set.

export const dynamic = 'force-static'

const WIDTH = 1200
const HEIGHT = 630

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), 'public', 'android-chrome-512x512.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 72,
          background: 'linear-gradient(135deg, #0f172a 0%, #1F2348 55%, #0f172a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={340} height={340} style={{ borderRadius: 48 }} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: '#F6B221' }}>TipWall</div>
          <div style={{ fontSize: 36, color: '#e2e8f0', maxWidth: 560 }}>
            The wall of creators support.
          </div>
          <div style={{ fontSize: 30, color: '#94a3b8' }}>
            Tip the creator. Not the platform.
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 26,
              color: '#0f172a',
              background: '#F6B221',
              padding: '10px 22px',
              borderRadius: 12,
              fontWeight: 700,
              alignSelf: 'flex-start',
            }}
          >
            tipwall.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
