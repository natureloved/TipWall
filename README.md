# TipWall - Nimiq Mini App

A living community tipping wall for creators on Nimiq. Built for the [Nimiq Mini Apps Competition](https://miniappscompetition.com).

## Features

- **Instant wallet integration** via Nimiq Pay Mini Apps SDK
- **NIM & USDT tipping** with customizable amounts
- **Milestone celebrations** - gamified goal tracking with confetti
- **Live tip feed** - real-time updates on your wall
- **OG preview** - beautiful link previews for shared content
- **Responsive design** - mobile-first with dark mode support

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
- `KV_REST_API_URL` - Vercel KV Upstash Redis URL
- `KV_REST_API_TOKEN` - Vercel KV token
- `NEXT_PUBLIC_APP_URL` - Your deployed app URL

3. Run development server:
```bash
npm run dev
```

4. Load in Nimiq Pay for testing (see [Load a local Mini App](https://nimiq.dev/mini-apps/load-local-mini-app))

## Mini App Integration

This app uses:
- `@nimiq/mini-app-sdk` for wallet connection and deep linking
- `@nimiq/hub-api` for checkout transactions
- Supports both NIM and USDT on Ethereum-compatible chains

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Creator setup form
│   ├── layout.tsx            # Root layout with theme support
│   └── api/
│       ├── tips/submit       # Tip submission endpoint
│       ├── tips/[handle]     # Fetch tips for a creator
│       ├── profile/create    # Create creator profile
│       └── og/route.ts       # OG metadata fetcher
├── components/
│   ├── TipModal.tsx          # Payment modal
│   ├── TipFeed.tsx           # Live tip feed display
│   ├── SupportersWall.tsx    # Top supporters display
│   ├── ContentPreviewCard.tsx  # Link preview card
│   └── ThemeToggle.tsx       # Dark/light mode toggle
└── lib/
    ├── nimiq.ts              # Nimiq SDK utilities
    ├── kv.ts                 # Vercel KV data layer
    └── types.ts              # TypeScript types
```

## Deploy

Deploy to Vercel with the KV integration for persistent storage.
