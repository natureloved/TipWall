// Regenerates every raster icon in public/ from the vector logo.svg so the
// icon set can never drift from the mark. Renders each size in headless
// Chromium (crisp SVG downscaling) and wraps the 32px PNG into favicon.ico.
//
// Usage: node scripts/render-icons.mjs

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.join(process.cwd(), 'public')
const load = async (file) => {
  const svg = await readFile(path.join(root, file), 'utf8')
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
const tiled = await load('logo.svg')
const maskable = await load('logo-maskable.svg')

const targets = [
  { size: 16, file: 'favicon-16x16.png', src: tiled },
  { size: 32, file: 'favicon-32x32.png', src: tiled },
  { size: 180, file: 'apple-touch-icon.png', src: tiled },
  { size: 192, file: 'android-chrome-192x192.png', src: tiled },
  { size: 512, file: 'android-chrome-512x512.png', src: maskable },
  { size: 512, file: 'logo.png', src: tiled },
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const { size, file, src } of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block">`,
  )
  const img = page.locator('img')
  await img.waitFor()
  await img.screenshot({ path: path.join(root, file), omitBackground: true })
  console.log(`rendered ${file} (${size}px)`)
}
await browser.close()

// favicon.ico: single 32x32 PNG entry in an ICO container (valid for all
// modern browsers, keeps one source of truth).
const png = await readFile(path.join(root, 'favicon-32x32.png'))
const ico = Buffer.alloc(22 + png.length)
ico.writeUInt16LE(0, 0) // reserved
ico.writeUInt16LE(1, 2) // type: icon
ico.writeUInt16LE(1, 4) // one image
ico.writeUInt8(32, 6) // width
ico.writeUInt8(32, 7) // height
ico.writeUInt8(0, 8) // palette
ico.writeUInt8(0, 9) // reserved
ico.writeUInt16LE(1, 10) // planes
ico.writeUInt16LE(32, 12) // bpp
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18) // offset
png.copy(ico, 22)
await writeFile(path.join(root, 'favicon.ico'), ico)
await writeFile(path.join(process.cwd(), 'src', 'app', 'favicon.ico'), ico)
console.log('rendered favicon.ico (32px PNG-in-ICO)')
