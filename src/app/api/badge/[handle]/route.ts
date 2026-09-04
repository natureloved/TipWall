import { NextResponse } from 'next/server'
import { getProfile, getVerifiedTotalNim } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Compact SVG badge for READMEs, blogs, and link-in-bio pages. It uses the
// current ink/paper/brick palette so embedded badges stay on-brand.

const FONT_WIDTH = 6.6 // Approximate px per character at 11px Verdana.
const PAD = 10
const HEIGHT = 24

function escapeSvg(value: string): string {
  return value.replace(/[&<>\"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&apos;',
  })[character] || character)
}

/** Compact NIM display: 950 -> "950", 12_400 -> "12.4k", 2_000_000 -> "2M". */
function compactNim(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0).replace(/\.0$/, '')}k`
  return `${Math.round(n)}`
}

function badgeSvg(rightText: string): string {
  const leftText = 'TipWall'
  const safeRightText = escapeSvg(rightText)
  const leftWidth = Math.round(leftText.length * FONT_WIDTH) + PAD * 2
  const rightWidth = Math.round(rightText.length * FONT_WIDTH) + PAD * 2 + 4
  const width = leftWidth + rightWidth
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" role="img" aria-label="${leftText}: ${safeRightText}">
  <title>${leftText}: ${safeRightText}</title>
  <clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="5" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${HEIGHT}" fill="#171614"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${HEIGHT}" fill="#F4F0E6"/>
    <rect x="${leftWidth}" width="4" height="${HEIGHT}" fill="#F05A3C"/>
  </g>
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="16" fill="#FBF7EE" font-weight="700">${leftText}</text>
    <text x="${leftWidth + 4 + (rightWidth - 4) / 2}" y="16" fill="#171614" font-weight="700">${safeRightText}</text>
  </g>
</svg>`
}

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!await withinRateLimit(request, 'badge-read', 60)) {
    return new NextResponse('rate limited', { status: 429, headers: { 'Content-Type': 'text/plain' } })
  }
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
    ? `tip @${handleStr} - ${compactNim(totalNIM)} NIM`
    : `tip @${handleStr} in NIM`

  return new NextResponse(badgeSvg(rightText), {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Cache at the edge for an hour; badges do not need to be real-time.
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
