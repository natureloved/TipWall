import { NextResponse } from 'next/server'
import { getProfile, getVerifiedTotalNim } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'

// Shields-style SVG badge for READMEs, blogs, and link-in-bio pages:
//   [ ⚡ TipWall | tip @handle · 1.2k NIM ]
// The right side carries the live verified total — social proof that updates
// itself wherever the badge is embedded.

const FONT_WIDTH = 6.6 // approx px per char at 11px Verdana
const PAD = 10

/** Compact NIM display: 950 -> "950", 12_400 -> "12.4k", 2_000_000 -> "2M". */
function compactNim(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0).replace(/\.0$/, '')}k`
  return `${Math.round(n)}`
}

function badgeSvg(rightText: string): string {
  const leftText = '⚡ TipWall'
  // The emoji renders wider than a normal glyph; count it as two chars.
  const leftWidth = Math.round((leftText.length + 1) * FONT_WIDTH) + PAD * 2
  const rightWidth = Math.round(rightText.length * FONT_WIDTH) + PAD * 2
  const width = leftWidth + rightWidth
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${leftText}: ${rightText}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#1F2348"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="#F6B221"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="14">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14" fill="#1F2348" font-weight="bold">${rightText}</text>
  </g>
</svg>`
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  // normalizeHandle strips everything outside [a-z0-9_-], so the text placed
  // into the SVG can never carry markup.
  const handleStr = normalizeHandle(handle)
  const profile = handleStr ? await getProfile(handleStr) : null
  if (!profile) {
    return new NextResponse(badgeSvg('creator not found'), {
      status: 404,
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  }

  const totalNIM = await getVerifiedTotalNim(handleStr)
  const rightText = totalNIM >= 1
    ? `tip @${handleStr} · ${compactNim(totalNIM)} NIM`
    : `tip @${handleStr} in NIM`

  return new NextResponse(badgeSvg(rightText), {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Cache at the edge for an hour; badges don't need to be real-time.
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
