// Extract the official `i-nimiq:*` icon set that nimiq.com inlines as data-URI SVGs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync("marketing/nim-assets/_nimiq-com.html", "utf8");
const outDir = "marketing/nim-assets/nimiq-icons";
mkdirSync(outDir, { recursive: true });

// Match:  :where(.i-nimiq\:NAME){ ... url("data:image/svg+xml,PAYLOAD") ... }
const re = /:where\(\.i-nimiq\\:([a-z0-9-]+)\)\{[^}]*?url\("data:image\/svg\+xml,([^"]+)"\)/g;

const found = new Map();
let m;
while ((m = re.exec(html)) !== null) {
  const [, name, payloadRaw] = m;
  if (found.has(name)) continue;
  try {
    // payload is percent-encoded (may contain %3C etc.) and possibly CSS-escaped
    const decoded = decodeURIComponent(payloadRaw.replace(/\\/g, ""));
    if (decoded.includes("<svg")) found.set(name, decoded);
  } catch {
    /* skip malformed */
  }
}

console.log(`extracted ${found.size} icons`);
for (const [name, svg] of found) {
  writeFileSync(`${outDir}/${name}.svg`, svg.trim() + "\n");
  console.log(`  ${name}.svg  (${svg.length} chars)`);
}
