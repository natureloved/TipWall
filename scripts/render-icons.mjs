// Regenerates every raster icon in public/ from the master art in
// logo-source.png so the icon set can never drift from the mark. Renders each
// size in headless Chromium and wraps the 32px PNG into favicon.ico.
//
// Usage: node scripts/render-icons.mjs

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.join(process.cwd(), 'public')

// The master is a full-bleed 1024px app icon: a rounded tile floating on a dark
// canvas. TILE is the tile's bounding box inside that canvas, measured off the
// source, so the derived icons crop to the tile instead of carrying its margin.
const SRC = 1024
const TILE = { x: 82, y: 68, size: 857, radius: 184 }
// The art draws a glowing blue rim around the tile. The UI already draws its own
// outline around the mark, so the two stack up as nested frames and read as
// cluttered. RIM_BAND is how far in that rim reaches; it is diffused away rather
// than cropped, because cropping to the mark would enlarge it and look tighter
// still. logo-source.png stays untouched so the rim is always recoverable.
const RIM_BAND = 44
const RIM_BLUR = 9
const RIM_PASSES = 120
// Canvas colour at the master's corners - used to pad the maskable icon so the
// tile does not float inside a black frame on launcher home screens.
const CANVAS = '#050e1d'
// Fraction of a maskable icon the tile may occupy: the safe zone is a circle
// 80% of the icon's width, so anything up to ~90% keeps the mark uncropped.
const MASKABLE_INSET = 0.9

const master = `data:image/png;base64,${(await readFile(path.join(root, 'logo-source.png'))).toString('base64')}`

const targets = [
  { size: 16, file: 'favicon-16x16.png', render: 'tile' },
  { size: 32, file: 'favicon-32x32.png', render: 'tile' },
  { size: 180, file: 'apple-touch-icon.png', render: 'tile' },
  { size: 192, file: 'android-chrome-192x192.png', render: 'tile' },
  { size: 512, file: 'logo.png', render: 'tile' },
  { size: 512, file: 'android-chrome-512x512.png', render: 'maskable' },
]

const browser = await chromium.launch()
const page = await browser.newPage()

// Diffusion inpainting: repeatedly blur the working copy and write the result
// back only inside the rim band, so the tile's interior gradient continues
// smoothly out to its edge with no glowing outline left.
const art = await page.evaluate(
  async ({ master, SRC, TILE, RIM_BAND, RIM_BLUR, RIM_PASSES }) => {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('master failed to load'))
      img.src = master
    })
    const work = document.createElement('canvas')
    work.width = SRC
    work.height = SRC
    const wctx = work.getContext('2d')
    wctx.drawImage(img, 0, 0)

    const blur = document.createElement('canvas')
    blur.width = SRC
    blur.height = SRC
    const bctx = blur.getContext('2d')

    const { x, y, size, radius } = TILE
    const ring = () => {
      wctx.beginPath()
      wctx.roundRect(x, y, size, size, radius)
      wctx.roundRect(x + RIM_BAND, y + RIM_BAND, size - RIM_BAND * 2, size - RIM_BAND * 2, radius - RIM_BAND)
      wctx.clip('evenodd')
    }

    for (let pass = 0; pass < RIM_PASSES; pass++) {
      bctx.clearRect(0, 0, SRC, SRC)
      bctx.filter = `blur(${RIM_BLUR}px)`
      bctx.drawImage(work, 0, 0)
      bctx.filter = 'none'
      wctx.save()
      ring()
      wctx.drawImage(blur, 0, 0)
      wctx.restore()
    }
    return work.toDataURL('image/png')
  },
  { master, SRC, TILE, RIM_BAND, RIM_BLUR, RIM_PASSES },
)

// The tile is positioned by offsetting a full-size copy of the art inside a
// clipping box, so the crop needs no resampling of its own.
const tileMarkup = (box) => {
  const scale = box / TILE.size
  const drawn = SRC * scale
  return (
    `<div style="position:relative;width:${box}px;height:${box}px;overflow:hidden;border-radius:${TILE.radius * scale}px">` +
    `<img src="${art}" width="${drawn}" height="${drawn}" style="position:absolute;left:${-TILE.x * scale}px;top:${-TILE.y * scale}px;display:block">` +
    `</div>`
  )
}

for (const { size, file, render } of targets) {
  await page.setViewportSize({ width: size, height: size })
  const body =
    render === 'maskable'
      ? `<div style="width:${size}px;height:${size}px;background:${CANVAS};display:flex;align-items:center;justify-content:center">${tileMarkup(Math.round(size * MASKABLE_INSET))}</div>`
      : tileMarkup(size)
  await page.setContent(`<body style="margin:0;background:transparent">${body}</body>`)
  await page.locator('img').waitFor()
  await page.screenshot({ path: path.join(root, file), omitBackground: true })
  console.log(`rendered ${file} (${size}px, ${render})`)
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
