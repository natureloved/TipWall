# TipWall - Nimiq Mini App

The support wall for people, projects, and communities. Tip directly. Not the platform. Built for the [Nimiq Mini Apps Competition](https://miniappscompetition.com).

[![Tip me on TipWall](https://tipwall.vercel.app/api/badge/tipwall?v=2)](https://tipwall.vercel.app/tipwall)

## Features

- **Instant wallet integration** via the Nimiq Pay Mini Apps SDK
- **NIM tipping** with preset or custom amounts, tip reasons, messages, and true anonymous mode (sender address never leaves the server)
- **Optional USDT on Polygon tipping** — wall owners add a Polygon payout address; supporters can pay from an injected EVM wallet or a wallet QR, and receipts are verified before the tip is counted
- **Low-friction NIM acquisition** — desktop visitors can pay with a plain-language Nimiq Hub popup; visitors without NIM get a balance-aware acquisition link or can ask someone else to pay with a preserved, shareable claim
- **On-chain verification** — every tip is checked against the Nimiq blockchain (node RPC + explorer fallback); only mined/in-block transactions count, and unverified tips are reconciled by a scheduled worker
- **Signature-bound ownership** — creating/editing a profile requires an Ed25519 signature from the owner wallet; no passwords, no sessions
- **Milestone celebrations** — gamified goal tracking with confetti, driven by lifetime verified totals
- **Live tip feed & supporters wall** — real-time updates on your wall
- **Owner moderation** — wall owners can hide, restore, or permanently remove supporter-authored public content without erasing the verified payment record
- **Tip recovery** — visitors without Nimiq Pay get a deep link / QR / shareable claim link that preserves their tip intent (non-custodial; no funds held)
- **Owner dashboard & funnel analytics** — owner-gated stats, 7-day charts, conversion tracking (anonymous, no PII), and share nudges when a wall goes quiet
- **Share Kit** — post-creation share flow with pre-written posts (X / Telegram / WhatsApp), QR code + downloadable poster, live GitHub README badge, and blog/link-in-bio embeds
- **Growth loops** — supporters get a share prompt after tipping, milestones offer one-tap shares, and `/explore` lists recently active walls
- **Social share cards** — dynamic OG images for every public wall
- **10-language tipping flow** (en, es, de, fr, it, pt, ru, zh, ja, ko), auto-detected from the browser — supporter and owner-facing surfaces use the same locale-aware translation layer
- **Responsive, accessible design** — mobile-first, pinch-zoom friendly
- **Full ownership, including exit** — wall owners can permanently delete their wall (signature-gated); deleted handles are tombstoned so nobody can re-register them and impersonate the previous owner
- **Wallet recovery and portability** — designate a recovery wallet, rotate ownership with two-party signatures, and export a wallet-signed, independently verifiable public wall snapshot or complete CSV tip history
- **Sustainable maintenance option** — deployments may configure an external sponsor link; it is separate from wall tips and never changes the 0% fee

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
- `POLYGON_RPC_URL` — Polygon JSON-RPC endpoint used to verify USDT receipts (required only when USDT is enabled)
- `USDT_POLYGON_TOKEN_ADDRESS` — server-side Polygon USDT contract address used for receipt verification
- `NEXT_PUBLIC_APP_URL` — Your deployed app URL (deep links, OG metadata, sitemap)
- `CRON_SECRET` — secret bearer token for scheduled pending-tip reconciliation

Optional deployment setting:
- `TIPWALL_TRUST_PROXY=1` — only for a non-Vercel ingress that sanitizes `x-forwarded-for`; otherwise rate limits intentionally use a shared fail-closed bucket.
- `NEXT_PUBLIC_SUPPORT_URL` — optional HTTPS/HTTP sponsor or maintenance-funding link. It is shown separately from wall tips and never changes the 0% fee.
- `NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS` — public copy of the Polygon USDT contract address. When set together with `POLYGON_RPC_URL` and a wall owner's Polygon payout address, supporters can pay in USDT from an EVM wallet or QR code.

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
npm run test:e2e   # Playwright browser smoke tests against a running production server
```

CI (GitHub Actions) runs lint, unit/API-route tests, a production build, and Playwright desktop/mobile smoke tests on every push/PR.

## Mini App Integration

This app uses:
- `@nimiq/mini-app-sdk` for wallet connection, message signing, payments, and deep linking
- `@noble/curves` / `@noble/hashes` for server-side Ed25519 signature verification and Nimiq address derivation

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Wall setup form (signature-bound)
│   ├── layout.tsx                # Root layout with theme support
│   ├── sitemap.ts                # /sitemap.xml incl. public walls
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
    ├── i18n.ts                   # 10-language UI strings
    └── wall-snapshot.ts          # Canonical public history + signed export format
```

## Security model

- **Profile ownership**: create/edit/delete/dashboard access requires a fresh (5-min TTL), single-use Ed25519 signature from the owner wallet; the signer address is re-derived from the public key server-side. Deletion erases all wall data and permanently tombstones the handle.
- **Tips**: recorded only with an on-chain txHash; verified against recipient + amount. txHash replay is blocked by a persistent per-wall set. Totals/milestones only count verified tips.
- **Chain finality**: a recipient/amount match is not verified unless the node or explorer reports block inclusion or at least one confirmation; mempool-only transactions remain pending.
- **Anonymous tips**: sender address is stripped from all API responses and excluded from the supporters wall.
- **Abuse controls**: KV-backed per-client limits cover public reads, wallet balance, profile mutations, tips, claims, tracking, and OG fetches; forwarding headers are trusted only on Vercel or when `TIPWALL_TRUST_PROXY=1`; OG fetching is restricted to profile content URLs (SSRF-guarded); reserved handles and field length caps on profiles.

### Portable wall snapshots

The dashboard's signed snapshot contains only confirmed, public tips and a
sanitized profile. Its payload is canonical JSON with recursively sorted object
keys and is signed by the owner's Nimiq wallet using the same
`nimiq-signed-message-v1` scheme used for profile authorization. The signature
envelope includes the wallet public key and signature; no private key or server
secret is involved. Anyone can reconstruct `TipWall wall snapshot v1` plus the
canonical payload, verify the Ed25519 signature, derive the Nimiq address, and
check it matches `profile.walletAddress` (and `ownerPublicKey` when present).

## Deploy

Deploy to Vercel with the KV integration for persistent storage. Set `CRON_SECRET` so the configured five-minute Vercel Cron can reconcile pending tips through `/api/cron/reverify`.

### Monitoring

API failures are emitted as structured JSON logs (`service`, `level`, `event`, timestamp, and error context), so
Vercel Logs and any connected log drain can filter incidents without parsing free-form messages. Configure an external
uptime check to request `GET /api/health` every five minutes; it verifies the KV read/write path, reports latency, and
returns a non-2xx status when the deployment is unhealthy. The endpoint never returns credentials or provider URLs.

This repository also includes a scheduled GitHub Actions probe (`.github/workflows/health.yml`). Set the repository
variable `TIPWALL_HEALTH_URL` when the production URL differs from `https://tipwall.vercel.app`; a failed probe marks the
workflow red and can notify the repository maintainers through GitHub's normal alerting.
