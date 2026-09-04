// Render each concept SVG to PNG (256 and 32) so we can actually compare.
import sharp from "sharp";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "marketing/logo-concepts";
const out = "marketing/logo-concepts/renders";
const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));

await import("node:fs/promises").then((fs) => fs.mkdir(out, { recursive: true }));

// also include the current logo for baseline comparison
const baseline = "public/logo.svg";
writeFileSync(path.join(dir, "_baseline.svg"), readFileSync(baseline));
const allSvgs = [...files, "_baseline.svg"];

for (const f of allSvgs) {
  const svgPath = path.join(dir, f);
  const baseName = f.replace(".svg", "");
  const svg = readFileSync(svgPath);
  // 256px preview
  await sharp(svg, { density: 384 })
    .resize(256, 256, { fit: "contain", background: { r: 244, g: 240, b: 230, alpha: 1 } })
    .png()
    .toFile(path.join(out, `${baseName}-256.png`));
  // 32px favicon reality check
  await sharp(svg, { density: 384 })
    .resize(32, 32, { fit: "contain", background: { r: 244, g: 240, b: 230, alpha: 1 } })
    .png()
    .toFile(path.join(out, `${baseName}-32.png`));
  console.log(`rendered ${f}`);
}
console.log("done");