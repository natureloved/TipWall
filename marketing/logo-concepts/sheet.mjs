// Build a comparison sheet: 7 concepts (baseline + 6 new), each shown at 256 and 32.
import sharp from "sharp";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = "marketing/logo-concepts/renders";
const cells = [
  ["_baseline-256.png", "_baseline-32.png", "CURRENT — coin on wall, heart inside"],
  ["01-coin-behind-wall-256.png", "01-coin-behind-wall-32.png", "01 — coin tucked behind wall, bolt inside"],
  ["02-bolt-piercing-wall-256.png", "02-bolt-piercing-wall-32.png", "02 — bolt pierces wall (coin sliver)"],
  ["03-monogram-t-brick-256.png", "03-monogram-t-brick-32.png", "03 — gold brick with T monogram"],
  ["04-tip-jar-slot-256.png", "04-tip-jar-slot-32.png", "04 — wall with coral tip-jar slot"],
  ["05-coin-stack-bricks-256.png", "05-coin-stack-bricks-32.png", "05 — wall of bricks, coin stack in middle"],
  ["06-coin-on-wall-bolt-256.png", "06-coin-on-wall-bolt-32.png", "06 — coin on wall (bolt), no tape"],
];

const W = 1024;
const rowH = 290;
const padX = 40;
const padY = 40;
const labelH = 50;
const bigSize = 220;
const smallSize = 96;
const gap = 24;

const H = padY * 2 + cells.length * (rowH + gap) - gap + 80;

const bg = { r: 244, g: 240, b: 230, alpha: 1 };
const ink = "#171614";

const composites = [];
for (let i = 0; i < cells.length; i++) {
  const [big, small, label] = cells[i];
  // build per-row PNG by composing the two image renders side by side with a label band
  const bigImg = sharp(path.join(dir, big)).resize(bigSize, bigSize, { fit: "contain", background: bg });
  const smallImg = sharp(path.join(dir, small)).resize(smallSize, smallSize, { fit: "contain", background: bg });
  const bigBuf = await bigImg.png().toBuffer();
  const smallBuf = await smallImg.png().toBuffer();
  const rowW = bigSize + smallSize + gap + 480;
  // text label area
  const rowBuf = await sharp({
    create: {
      width: rowW,
      height: rowH,
      channels: 4,
      background: i === 0 ? { r: 255, g: 230, b: 220, alpha: 1 } : { r: 251, g: 247, b: 238, alpha: 1 },
    },
  })
    .composite([
      { input: bigBuf, top: (rowH - bigSize) / 2, left: padX },
      { input: smallBuf, top: (rowH - smallSize) / 2, left: padX + bigSize + gap },
    ])
    .png()
    .toBuffer();
  // overlay text using SVG
  const textSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${rowW}" height="${rowH}">
      <style>
        .lbl { font: 600 24px ui-sans-serif, system-ui, sans-serif; fill: ${ink}; }
        .sub { font: 500 16px ui-sans-serif, system-ui, sans-serif; fill: #635b4f; }
      </style>
      <text class="lbl" x="${padX + bigSize + smallSize + gap * 2}" y="${rowH / 2 - 8}">${label.split(" — ")[0] ?? label}</text>
      <text class="sub" x="${padX + bigSize + smallSize + gap * 2}" y="${rowH / 2 + 22}">${label.split(" — ").slice(1).join(" — ") || ""}</text>
    </svg>`;
  const rowWithText = await sharp(rowBuf)
    .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  composites.push({ input: rowWithText, top: padY + i * (rowH + gap), left: padX });
}

// Title block
const titleSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W - padX * 2}" height="60">
    <style>
      .t { font: 700 32px ui-sans-serif, system-ui, sans-serif; fill: ${ink}; }
      .s { font: 500 16px ui-sans-serif, system-ui, sans-serif; fill: #635b4f; }
    </style>
    <text class="t" x="0" y="28">TipWall logo — concept comparison</text>
    <text class="s" x="0" y="52">Each row shows the 256px preview on the left and the 32px favicon reality check on the right.</text>
  </svg>`;

const sheet = await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 244, g: 240, b: 230, alpha: 1 } },
})
  .composite([...composites, { input: Buffer.from(titleSvg), top: padY / 2, left: padX }])
  .png()
  .toFile(path.join(dir, "_comparison-sheet.png"));

await sheet;
console.log("sheet written:", path.join(dir, "_comparison-sheet.png"));