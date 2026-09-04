import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'

async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`TipWall did not become ready at ${baseUrl}`)
}

await waitForServer()
const browser = await chromium.launch({ headless: true })
try {
  const cases = [
    { viewport: { width: 1280, height: 800 }, locale: 'en-US', exploreHeading: 'Find people worth supporting.' },
    { viewport: { width: 390, height: 844 }, locale: 'fr-FR', exploreHeading: 'Trouvez des personnes à soutenir.' },
  ]
  for (const { viewport, locale, exploreHeading } of cases) {
    const page = await browser.newPage({ viewportSize: viewport, locale })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('h1').first().innerText(), 'Every supporter\nleaves a mark.')
    assert.equal(await page.getByRole('button', { name: /Make your wall/i }).isVisible(), true)
    await page.getByRole('link', { name: /Explore/i }).first().click()
    await page.waitForURL('**/explore')
    assert.equal(await page.locator('h1').innerText(), exploreHeading)
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= body.clientWidth), true)
    await page.close()
  }
} finally {
  await browser.close()
}
