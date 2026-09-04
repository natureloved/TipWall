import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Stable banner asset for listings and submissions (mini-app directories,
// competition forms, social cards): https://<host>/banner.png - 1200x630 PNG
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
          gap: 64,
          padding: 64,
          background: '#F4F0E6',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={300}
          height={300}
          style={{ borderRadius: 44, border: '5px solid #171614', boxShadow: '12px 12px 0 #F05A3C' }}
          alt=""
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#746B5E', fontFamily: 'monospace' }}>
            PUBLIC SUPPORT WALL
          </div>
          <div style={{ fontSize: 82, fontWeight: 800, color: '#171614', lineHeight: 1.05 }}>
            Support people,
          </div>
          <div style={{ fontSize: 82, fontWeight: 800, color: '#B9382A', fontStyle: 'italic', lineHeight: 1.05 }}>
            not the platform.
          </div>
          <div style={{ fontSize: 32, color: '#5F574B', marginTop: 8, maxWidth: 560 }}>
            Every supporter leaves a mark. On-chain, 0% fee.
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 26,
              color: '#FBF7EE',
              background: '#171614',
              padding: '10px 26px',
              borderRadius: 999,
              fontWeight: 700,
              alignSelf: 'flex-start',
              boxShadow: '5px 5px 0 #F05A3C',
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
