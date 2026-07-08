# TipWall - Nimiq Mini App

The wall of creators support. Tip the creator. Not the platform. Built for the [Nimiq Mini Apps Competition](https://miniappscompetition.com).

## Features

- **Instant wallet integration** via the Nimiq Pay Mini Apps SDK
- **NIM tipping** with preset or custom amounts, tip reasons, messages, and true anonymous mode (sender address never leaves the server)
- **On-chain verification** — every tip is checked against the Nimiq blockchain (node RPC + explorer fallback); unverified tips show as "Pending" and are re-verified on read
- **Signature-bound ownership** — creating/editing a profile requires an Ed25519 signature from the owner wallet; no passwords, no sessions
- **Milestone celebrations** — gamified goal tracking with confetti, driven by lifetime verified totals
- **Live tip feed & supporters wall** — real-time updates on your wall
- **Tip recovery** — visitors without Nimiq Pay get a deep link / QR / shareable claim link that preserves their tip intent (non-custodial; no funds held)
- **Creator dashboard & funnel analytics** — owner-gated stats, 7-day charts, conversion tracking (anonymous, no PII), and share nudges when a wall goes quiet
- **Share Kit** — post-creation share flow with pre-written posts (X / Telegram / WhatsApp), QR code + downloadable poster, live GitHub README badge, and blog/link-in-bio embeds
- **Growth loops** — supporters get a share prompt after tipping, milestones offer one-tap shares, and `/explore` lists recently active walls
- **Social share cards** — dynamic OG images per creator wall
- **10-language UI** (en, es, de, fr, it, pt, ru, zh, ja, ko), auto-detected from the browser
- **Responsive, accessible design** — mobile-first, dark/light theme, pinch-zoom friendly

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and configure:
```bash
cp .env.example .env.local
```

Required environment variables:
- `KV_REST_API_URL` — Vercel KV (Upstash Redis) REST URL
- `KV_REST_API_TOKEN` — Vercel KV token
- `NIMIQ_RPC_URL` — Nimiq PoS node JSON-RPC endpoint (e.g. `https://api.nimiq.com`), used to verify tips on-chain
- `NEXT_PUBLIC_APP_URL` — Your deployed app URL (deep links, OG metadata, sitemap)

3. Run development server:
```bash
npm run dev
```

4. Load in Nimiq Pay for testing (see [Load a local Mini App](https://nimiq.dev/mini-apps/load-local-mini-app))

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint over src/
npm test           # vitest unit tests (signature verification, tx verification, validation)
```

CI (GitHub Actions) runs lint + tests + build on every push/PR.

## Mini App Integration

This app uses:
- `@nimiq/mini-app-sdk` for wallet connection, message signing, payments, and deep linking
- `@noble/curves` / `@noble/hashes` for server-side Ed25519 signature verification and Nimiq address derivation

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Creator setup form (signature-bound)
│   ├── layout.tsx                # Root layout with theme support
│   ├── sitemap.ts                # /sitemap.xml incl. creator walls
│   ├── explore/                  # Recently active walls (discovery)
│   ├── [handle]/
│   │   ├── page.tsx              # Public tipping wall
│   │   ├── opengraph-image.tsx   # Dynamic OG share card
│   │   ├── share/                # Share Kit (link, QR, badge, embeds)
│   │   ├── dashboard/            # Owner dashboard (signed view auth)
│   │   ├── analytics/            # Owner funnel analytics
│   │   └── edit/                 # Owner profile editing
│   ├── claim/[token]/            # Cross-device tip recovery
│   └── api/
│       ├── tips/submit           # Tip submission + on-chain verification
│       ├── tips/[handle]         # Public tips (anonymous-sanitized)
│       ├── profile/create        # Create profile (wallet signature required)
│       ├── profile/[handle]      # Read / owner-signed edit
│       ├── profile/wallet        # Signed lookup: wallet -> profile
│       ├── claim/create|[token]  # Non-custodial claim intents
│       ├── stats/track|[handle]  # Anonymous funnel counters
│       ├── badge/[handle]        # Live SVG badge for READMEs
│       └── og                    # OG metadata for a profile's content link
├── components/                   # TipModal, TipFeed, SupportersWall, ...
└── lib/
    ├── nimiq.ts                  # Mini App SDK helpers (client)
    ├── verify-signature.ts       # Ed25519 + Nimiq address derivation (server)
    ├── verify-tx.ts              # On-chain tx verification (RPC + explorer)
    ├── profile-auth.ts           # Canonical signed-message format (shared)
    ├── validate-profile.ts       # Handle/field validation and caps
    ├── kv.ts                     # Vercel KV data layer + aggregates
    └── i18n.ts                   # 10-language UI strings
```

## Security model

- **Profile ownership**: create/edit/dashboard access requires a fresh (5-min TTL), single-use Ed25519 signature from the owner wallet; the signer address is re-derived from the public key server-side.
- **Tips**: recorded only with an on-chain txHash; verified against recipient + amount. txHash replay is blocked by a persistent per-creator set. Totals/milestones only count verified tips.
- **Anonymous tips**: sender address is stripped from all API responses and excluded from the supporters wall.
- **Abuse controls**: KV-backed per-IP rate limits on tips, claims, tracking, and OG fetches; OG fetching is restricted to profile content URLs (SSRF-guarded); reserved handles and field length caps on profiles.

## Deploy

Deploy to Vercel with the KV integration for persistent storage.
