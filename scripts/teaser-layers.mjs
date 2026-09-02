import { chromium } from 'playwright';
import path from 'node:path';

const html = path.resolve('marketing/teaser/layers.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
await page.goto(`file:///${html.replace(/\\/g, '/')}`);
await page.waitForTimeout(500);

for (const id of ['hook', 'capwall', 'overlaymock', 'capexplore', 'cta']) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: `marketing/teaser/frames/layer-${id}.png`, omitBackground: true });
  console.log('saved layer-' + id);
}
await browser.close();
console.log('DONE');
