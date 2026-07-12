// Records a captioned demo of the live TipWall app with Playwright.
// Usage: node scripts/record-demo.mjs <output-dir>
import { chromium } from 'playwright'

const BASE = 'https://tipwall.vercel.app'
const OUT_DIR = process.argv[2] || '.'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function caption(page, text) {
  await page.evaluate((t) => {
    let bar = document.getElementById('demo-caption')
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'demo-caption'
      Object.assign(bar.style, {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
        maxWidth: '86%', padding: '14px 22px', borderRadius: '16px',
        background: 'rgba(15,23,42,0.94)', border: '2px solid rgba(246,178,33,0.65)',
        color: '#fde68a', fontSize: '26px', fontWeight: '700', textAlign: 'center',
        fontFamily: 'system-ui, sans-serif', zIndex: '999999', lineHeight: '1.35',
        boxShadow: '0 8px 30px rgba(0,0,0,0.55)', transition: 'opacity 300ms',
        pointerEvents: 'none', // never intercept the clicks being demoed
      })
      document.body.appendChild(bar)
    }
    bar.style.opacity = '0'
    setTimeout(() => { bar.textContent = t; bar.style.opacity = '1' }, 250)
  }, text)
  await sleep(500)
}

async function smoothScroll(page, totalPx, stepPx = 12, stepMs = 16) {
  const steps = Math.round(Math.abs(totalPx) / stepPx)
  const dir = totalPx > 0 ? stepPx : -stepPx
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dir)
    await sleep(stepMs)
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 700, height: 1456 },
  
  recordVideo: { dir: OUT_DIR, size: { width: 700, height: 1456 } },
})
const page = await ctx.newPage()
// 'networkidle' never settles here (analytics beacons keep firing) — use
// 'load' + explicit sleeps instead, and fail fast on missing selectors.
page.setDefaultTimeout(15000)
const step = (n) => console.log('step:', n)

// 1. Home / create form
step('home')
await page.goto(`${BASE}/`, { waitUntil: 'load' })
await sleep(1500)
await caption(page, 'Create your TipWall in under a minute — your wallet is your account.')
await sleep(3600)
await smoothScroll(page, 500)
await sleep(1800)

// 2. The wall
step('wall')
await page.goto(`${BASE}/tipwall`, { waitUntil: 'load' })
await sleep(2500)
await caption(page, 'Every creator gets a living tipping wall — tips, supporters, goals, milestones.')
await sleep(3200)
await smoothScroll(page, 900)
await sleep(1500)
await caption(page, 'On-chain verified tips. Top supporters get recognition.')
await smoothScroll(page, 700)
await sleep(2200)
await smoothScroll(page, -1600, 20, 10)
await sleep(800)

// 3. Tip flow
step('tip modal')
await page.getByRole('button', { name: 'Send a Tip' }).click()
await sleep(1000)
await caption(page, 'Supporters tip NIM straight to the creator’s wallet — no platform, no fees.')
await sleep(1800)
await page.getByRole('button', { name: 'Just support' }).click()
await sleep(1200)
await page.getByRole('button', { name: '100 NIM', exact: true }).click()
await sleep(1200)
await page.getByPlaceholder('Add a message (optional)').fill('Love what you are building! 🔥')
await sleep(1800)
step('send')
await page.getByRole('button', { name: /Continue in Nimiq Pay|NIM —/ }).click()
await sleep(1500)
await caption(page, 'No Nimiq Pay yet? Your tip is saved — scan to finish it inside the app.')
await sleep(3500)
// Pledge: reserve the tip as a claim link
const pledge = page.getByRole('button', { name: /Support Later/ })
if (await pledge.count()) {
  step('pledge')
  await pledge.click()
  await sleep(1500)
  await caption(page, 'Or reserve it: a non-custodial claim link finishes the tip from any device.')
  await sleep(3500)
}

// 4. Share Kit
step('share kit')
await page.goto(`${BASE}/tipwall/share`, { waitUntil: 'load' })
await sleep(2000)
await caption(page, 'The Share Kit: one-tap posts, QR posters, a live GitHub badge and embeds.')
await sleep(3000)
await smoothScroll(page, 800)
await sleep(1600)
await smoothScroll(page, 800)
await sleep(1800)

// 5. Explore
step('explore')
await page.goto(`${BASE}/explore`, { waitUntil: 'load' })
await sleep(1500)
await caption(page, 'Discover recently active walls — every wall is a doorway to more creators.')
await sleep(2800)
await smoothScroll(page, 600)
await sleep(1500)

// 6. End card
step('end card')
await page.goto(`${BASE}/banner.png`, { waitUntil: 'load' })
await page.evaluate(() => { document.body.style.background = '#0f172a' })
await sleep(3500)

await ctx.close()
const video = await page.video().path()
console.log('VIDEO:', video)
await browser.close()
