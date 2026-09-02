import { chromium } from 'playwright';
import fs from 'node:fs';

const base = 'https://tipwall.vercel.app';
const out = 'marketing/teaser/frames';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/home.png` });
console.log('saved home.png');

await page.goto(`${base}/explore`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/explore.png` });
console.log('saved explore.png');

const href = await page.evaluate(() => {
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href^="/"]')) {
    const h = a.getAttribute('href');
    if (!h || h.includes('?') || h.includes('explore') || h.includes('dashboard') || h.length < 2) continue;
    if (!seen.has(h)) { seen.add(h); return h; }
  }
  return null;
});
console.log('creator wall:', href);

if (href) {
  await page.goto(`${base}${href}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/wall.png` });
  console.log('saved wall.png');

  await page.goto(`${base}${href}/overlay`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/overlay.png`, omitBackground: true });
  console.log('saved overlay.png');
}

await browser.close();
console.log('DONE');
