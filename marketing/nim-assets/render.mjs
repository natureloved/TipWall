// Render the NIM assets at multiple sizes so they can be eyeballed.
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const dir = "marketing/nim-assets";
const out = path.join(dir, "renders");
mkdirSync(out, { recursive: true });

const files = [
  "nim-hexagon-official.svg",
  "nim-hexagon-mono.svg",
  "nim-coin-round.svg",
  "nim-coin-hexagon.svg",
  "official-hexagon.svg",
];

const SIZES = [512, 64, 32, 16];

for (const f of files) {
  const svg = readFileSync(path.join(dir, f));
  for (const s of SIZES) {
    await sharp(svg, { density: 384 })
      .resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(out, `${f.replace(".svg", "")}-${s}.png`));
  }
  console.log(`rendered ${f}`);
}

// Contact sheet: 64px + 32px + 16px rows on paper background
const rows = files.map((f) => ({
  file: f,
  label: f.replace(".svg", ""),
}));

const cellH = 96;
const labelW = 300;
const sizes = [64, 32, 16];
const W = labelW + sizes.length * 110;
const H = cellH * rows.length + 40;

const composites = [];
for (let i = 0; i < rows.length; i++) {
  const yTop = i * cellH + 40;
  let x = labelW;
  for (const s of sizes) {
    const buf = await readFileSync(path.join(out, `${rows[i].file.replace(".svg", "")}-${s}.png`));
    composites.push({ input: buf, top: yTop + (cellH - s) / 2 - 10, left: x });
    x += 110;
  }
}

const labelSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .t { font: 600 20px ui-sans-serif, system-ui, sans-serif; fill: #171614; }
    .h { font: 600 22px ui-sans-serif, system-ui, sans-serif; fill: #171614; }
  </style>
  <text class="h" x="20" y="26">NIM assets — extracted from Nimiq official sources</text>
  ${rows
    .map(
      (r, i) =>
        `<text class="t" x="20" y="${i * cellH + 40 + cellH / 2}">${r.label}</text>`
    )
    .join("")}
  ${sizes
    .map((s, i) => `<text class="t" x="${labelW + i * 110}" y="36">${s}px</text>`)
    .join("")}
</svg>`;

await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 244, g: 240, b: 230, alpha: 1 } },
})
  .composite([...composites, { input: Buffer.from(labelSvg), top: 0, left: 0 }])
  .png()
  .toFile(path.join(out, "_sheet.png"));

console.log("sheet written");
