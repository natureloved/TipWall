# What TipWall Is

*A current-state description, written after the critical-fix pass and the integration of the recommended implementations.*

---

## 1. The one-paragraph version

TipWall is a **non-custodial, zero-fee creator tipping wall built on Nimiq**. A creator claims a handle, gets a public page (`tipwall.vercel.app/yourhandle`), and supporters send NIM directly to the creator's own wallet — TipWall never holds, routes, or custodies a single coin. What makes it more than a donate button is that **every tip carries a reason**, and the wall is **durable public history**: the messages stay on the wall permanently, they are verified on-chain before they count, and the creator can export the whole thing as a wallet-signed, independently verifiable snapshot. Built as a Nimiq Mini App for the Nimiq Mini Apps Competition Cycle II.

---

## 2. The pain point, and the wedge

Three things are broken about creator monetisation today, and TipWall attacks the gap between them:

| Option | What it costs | What it destroys |
|---|---|---|
| **Patreon / Ko-fi / Buy Me a Coffee** | 5–12% plus payment processing | Requires an account, a payout rail, a country that Stripe serves. Gated, not global. |
| **Raw wallet address in bio** | 0% | Zero feedback. The creator sees a number move and learns nothing. No record, no thanks, no signal. |
| **On-chain donation platforms** | Variable | Usually a token, a DAO, or a staking requirement. The donor has to already be a crypto person. |

TipWall's wedge is the intersection: **0% fee like a raw address, but with the feedback loop of a platform.** The insight that makes it more than a tip jar is that **the tip amount is the least interesting part of a tip**. The interesting part is *why* — "helpful content", "great idea", "tutorial", "open source", "just support". That reason, aggregated over time, is a signal no raw wallet address and no Patreon dashboard gives you: it tells the creator *what to make more of*.

---

## 3. The core object: the wall

A **wall** is a handle plus a verified Nimiq address. That's the whole primitive. Everything else layers on top:

- **Handle** — a short public name, namespaced and tombstoned on deletion so nobody can re-register it and impersonate a former owner.
- **Wallet** — the creator's own Nimiq address, checksum-validated, plus an optional Polygon address for USDT.
- **Profile** — display name, bio, category (art / code / education / music / video / gaming / freelance / student / community), theme (five curated palettes), optional content link.
- **Tips** — append-only. Verified on-chain. Carry amount, optional message, optional reason, optional anonymity.
- **Milestones** — lifetime verified total crossing 100 / 500 / 1000 / 5000 / 10000 NIM triggers a celebration and a one-tap share.

**Ownership is signature-bound, not account-bound.** There are no passwords, no sessions, no email. To create, edit, delete, moderate, or view the dashboard, the owner signs a canonical human-readable message with their Nimiq wallet. The server re-derives the Nimiq address from the public key and checks it matches. The signed message has a 5-minute TTL and burns a single-use nonce in Redis, so a captured signature is worthless after five minutes or one use.

---

## 4. The supporter journey

A visitor lands on a wall. They pick an amount, optionally say why, optionally leave a message, optionally tick anonymous. Then one of four payment paths, chosen automatically from the environment:

**Path 1 — In-wallet (Nimiq Pay Mini App).** The best path. The wall is opened inside the Nimiq Pay app, the Mini App SDK handles connection and `sendBasicTransaction`, and the payment is one tap with no context switch. This is the primary path and the one the competition rewards.

**Path 2 — Nimiq Hub desktop popup.** A desktop browser visitor gets a plain-language button — "⚡ Pay with your Nimiq wallet" (previously "Pay via Nimiq Hub", jargon, now reworded). The Hub API is dynamically imported so it never touches the initial bundle.

**Path 3 — Scan-to-pay QR.** Mobile-to-desktop and cross-device. The tip intent is encoded as a `nimiq:` URI with an attribution nonce in the transaction's `extra_data`. The nonce was previously a hard gate — if the server couldn't match it, the tip silently vanished. It is now a *tiebreaker*: the server prefers a nonce match and otherwise falls back to the most recent matching transaction. This was the single worst bug in the product and it is fixed.

**Path 4 — USDT on Polygon.** New. A wall owner can add a Polygon payout address; supporters pay USDT from an injected EVM wallet or a wallet QR. Receipts are verified server-side against a Polygon RPC before the tip counts. 6-decimal arithmetic, chain ID `0x89`, contract address from env.

**If the visitor has no NIM at all**, the modal now detects it: it reads their balance, disables the pay button on insufficient funds, and offers a link to acquire NIM. Previously this funnel dead-ended silently.

**If the visitor has no Nimiq wallet at all**, they get a **claim link** — a shareable, non-custodial record of the tip intent (amount, reason, message) that someone else can pay on their behalf, or that they can resume on another device. No funds are ever held by TipWall.

---

## 5. The creator journey

1. **Create** — pick a handle, paste a Nimiq address (now checksum-validated client-side *before* signing, and server-side at both entry points), sign. Live in under a minute.
2. **Share** — the Share Kit generates pre-written posts for X / Telegram / WhatsApp, a QR code, a downloadable poster, a live SVG badge for a README that renders the real tip count, and blog / link-in-bio embeds. Dynamic OG cards per wall.
3. **Receive** — tips appear on the wall in real time with confetti and a live feed.
4. **Understand** — the owner dashboard shows lifetime verified totals, a 7-day chart, anonymous (no-PII) funnel conversion tracking, **top reason signal**, and share nudges when a wall goes quiet.
5. **Moderate** — owners can hide, restore, or permanently remove supporter-authored public content **without erasing the verified payment record**. The money still counted; only the message goes.
6. **Own the exit** — permanently delete the wall (signature-gated, handle tombstoned), export a complete CSV tip history, or export a **signed portable wall snapshot**.

### Wallet recovery and the portability guarantee

This is the part that answers the fair objection to any hosted creator tool: *what if the platform dies?*

- **Recovery wallet** — designate a second Nimiq address that can recover a wall.
- **Ownership rotation** — transfer a wall to a new wallet with two-party signatures.
- **Signed snapshots** — the dashboard exports canonical JSON (recursively sorted keys, deterministic) containing only confirmed public tips plus a sanitized profile, signed by the owner's Nimiq wallet under the same `nimiq-signed-message-v1` scheme used for authorization. The envelope carries the wallet public key. Anyone can reconstruct the payload, verify the Ed25519 signature, derive the Nimiq address, and confirm it matches `profile.walletAddress`. **No private key and no server secret is involved.** The wall's history is portable and independently verifiable forever, whether or not TipWall exists.

---

## 6. Security and trust model

| Layer | Mechanism |
|---|---|
| **Ownership** | Ed25519 signature from owner wallet; 5-min TTL + single-use nonce; address re-derived server-side from public key. No passwords, no sessions. |
| **Address integrity** | Full Nimiq address validation: `NQ` prefix, 36 chars, Crockford-style base32 body (no I/L/O/Z), and an **IBAN mod-97 checksum**. Catches 100% of single-character typos and essentially all transpositions. One shared `nimiqCheckDigits()` implementation is used by *both* address derivation and address validation, so the two can never drift. Enforced client-side pre-sign and server-side at both profile mutation routes. 19 dedicated tests, including a derivation/validation agreement suite over 25 derived keys. |
| **Tip authenticity** | Every tip is verified against the Nimiq blockchain (node JSON-RPC with nimiqwatch explorer fallback) for recipient **and** amount. txHash replay blocked by a persistent per-wall set. |
| **Chain finality** | A recipient/amount match is **not** verified unless the node or explorer reports block inclusion or ≥1 confirmation. Mempool-only transactions stay pending. This closes the "verify then reorg" hole. |
| **Privacy** | Anonymous tips have the sender address stripped from all API responses and excluded from the supporters wall. It never leaves the server. |
| **Abuse** | Per-client rate limits on **24 of 25 API routes**. Client IP derivation is fail-closed: forwarding headers are trusted only on Vercel (`VERCEL=1`) or with explicit `TIPWALL_TRUST_PROXY=1`, and the **rightmost** XFF hop is taken. |
| **Transport** | CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, HSTS with preload, `Referrer-Policy`. |
| **Injection** | HTML escaping on all rendered user content; OG fetching restricted to profile content URLs (SSRF-guarded). |
| **Registration** | Reserved handles, field length caps. |

---

## 7. Reliability and operations

- **Read-path purity.** Public GET endpoints no longer write to KV or call upstream RPC. A test (`kv-read-purity.test.ts`) enforces this.
- **Bounded pending-tip reconciliation.** Tips that can't be confirmed are retried on a backoff schedule (30s → 1m → 5m → 15m → 1h), capped at 6 attempts and a 24-hour TTL, then dropped. Previously they retried forever on every read — an unbounded, self-inflicted DoS that grew worse with traffic.
- **Scheduled worker.** `/api/cron/reverify` runs every 5 minutes via Vercel Cron, gated by a `CRON_SECRET` bearer token, returning 503 if unconfigured. Per-wall error isolation, so one broken wall can't stall the sweep.
- **Structured logging.** JSON logs with `service` / `level` / `event` / timestamp plus error context, so a log drain can filter incidents without parsing prose.
- **Health endpoint.** `/api/health` exercises the KV read/write path, reports latency, returns non-2xx when unhealthy, and never leaks credentials or provider URLs. Backed by a scheduled GitHub Actions probe.
- **Observability of the product itself.** Anonymous funnel counters on the conversion path; `/api/stats/ecosystem` for live totals.

---

## 8. Verified state

Measured on the current working tree, not taken from documentation:

| Metric | Value |
|---|---|
| Source files (`.ts` / `.tsx` under `src/`) | **139** |
| Lines of code | **14,397** |
| Unit tests | **146 passing across 24 files** (up from 83 / 12) |
| ESLint | **exit 0, clean** |
| API routes | **25**, of which **24 rate-limited** |
| Languages in the UI | **10** (en, es, de, fr, it, pt, ru, zh, ja, ko), auto-detected from the browser |
| Pages | 14 |
| Runtime dependencies | 11 — the unused 27 MB `@nimiq/core` was removed |
| Live health | `{"status":"OK","kv":"OK","nimiqRpcConfigured":true}` |
| Live ecosystem | 8 walls · 64 tips · 19,030 NIM |

Test coverage now includes: signature verification, transaction verification, address validation, KV read purity, discoverability handles, feed logic, i18n completeness, profile authorization, USDT decimal math, Nimiq balance parsing, reason signals, KV recency, public snapshots, wallet indexing, tip sanitization, HTML escaping, environment configuration, API route contracts, and explore sorting.

---

## 9. Positioning

**Against Patreon / Ko-fi:** they take 5–12% and require an account in a served country. TipWall takes 0% and requires a wallet. TipWall loses on recurring subscriptions and on "it just works with a credit card" — it is not trying to be a membership platform.

**Against a raw Nimiq address in a bio:** the raw address is marginally simpler and equally fee-free, and it is TipWall's real competitor. TipWall wins on the feedback loop (reasons, messages, thanks), on durable public history, on discovery (`/explore`), and on analytics. It must never lose on trust — which is exactly why the signed portable snapshot and the append-only guarantee matter.

**Against other Nimiq Mini Apps:** most are demos, DeFi toys, or utilities with a narrow loop. TipWall is a consumer product with a sharing loop, a retention loop (milestones, share nudges), a real analytics story, and an exit guarantee.

**Against the competition rubric** (45 functionality / 25 Nimiq integration / 15 real usage / 10 design / 5 promotion):

- **Nimiq integration (25)** is the strongest category — mini-app SDK, Hub API, and scan-to-pay are all wired, address derivation and verification are done in-house with `@noble`, on-chain verification is real, and USDT on Polygon is additive rather than a substitute.
- **Functionality (45)** is strong post-fix: the four critical defects (address validation, silent scan-to-pay, the 200-tip cap that deleted history, unbounded pending retries) are all resolved, and the moderation / recovery / snapshot / analytics surface is broad.
- **Design (10)** is solid — five curated palettes, mobile-first, accessible, OG cards, live feed.
- **Real usage (15)** is the weakest and least controllable: 8 walls and 64 tips on-chain. This is a distribution problem, not an engineering one, and it is where attention has to go now.
- **Promotion (5)** requires public building-in-the-open between now and the 18 September deadline.

---

## 10. What TipWall is not

Stating the boundaries honestly, because a product description that claims everything claims nothing:

- **Not a payment processor.** It never touches funds. It verifies that a payment happened.
- **Not a subscription platform.** One-off tips only. The pledge feature was removed rather than shipped half-built.
- **Not custodial, ever.** The claim flow preserves intent; it does not hold value.
- **Not a DAO, a token, or a governance experiment.** It is a tool.
- **Not fiat on-ramped.** A non-crypto supporter still needs to acquire NIM or USDT. The acquisition link and the USDT path reduce this friction; they don't remove it. This is the single largest remaining barrier for the "non-crypto user" audience.
- **Not decentralised at the storage layer.** Tips live in Vercel KV (Upstash Redis). The signed snapshot is the mitigation: the data is portable and verifiable even if the index disappears.

---

## 11. Two caveats you should know about before tomorrow

Both are matters of process, not of code quality — the code is green.

**1. Nothing is committed.** `git log -1` is still `690cd0c` ("Improve live tipping and creator wall experience"). **119 files are uncommitted and unpushed.** Every fix described in this document exists on disk and nowhere else. If this machine dies, the work dies with it.

**2. The live site does not serve the new code.** `https://tipwall.vercel.app` returns only `Strict-Transport-Security` — the new CSP, `X-Frame-Options`, and `X-Content-Type-Options` are **not** in the response headers, and ecosystem stats are unchanged at 8 walls / 64 tips / 19,030 NIM. That is consistent with the deployment still running the pre-fix build. The security headers, the address validation, the append-only wall, the bounded retries, USDT, moderation, recovery, and snapshots are all **live-ready but not live**.

Commit, push, and let CI redeploy before any of this counts toward the competition — particularly the "real usage" category, which is scored on what the deployed app demonstrably does.
