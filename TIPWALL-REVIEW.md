# TipWall — Multi-Lens Technical & Product Review

**Reviewed:** 2026-09-03 · **Repo:** `github.com/natureloved/TipWall` · **Live:** `tipwall.vercel.app`
**Context:** Nimiq Mini Apps Competition, Cycle II (Aug 24 → **Sept 18, 2026** — 15 days left)

---

## 0. Audit basis (what I actually verified, not assumed)

| Check | Result |
|---|---|
| Source size | 11,166 LOC TypeScript/TSX across 110 files |
| `npx vitest run` | **83 passed** (12 files) |
| `npx eslint src` | **Clean, exit 0** |
| `/api/health` (live) | `{"status":"OK","kv":"OK","nimiqRpcConfigured":true}` |
| `/api/stats/ecosystem` (live) | **8 walls · 64 verified tips · 19,030 NIM** lifetime |
| Licence | MIT ✓ (competition requirement) |
| Repo visibility | Public ✓ |
| Env secrets in git | None — `.env*` correctly gitignored ✓ |
| CI | Lint + test + build on push/PR ✓ |

Everything below is grounded in reading the actual code paths, not the README's claims.

---

## 1. The pain point it solves — and whether the wedge holds

### The real pain (this part is honest and defensible)

Creator monetization platforms take a cut, and they strip meaning from money:

| Platform | Effective take |
|---|---|
| YouTube Super Chat / Twitch Bits | ~30–40% |
| Patreon | ~8–12% + processing |
| Buy Me a Coffee | 5% |
| Ko-fi | 0% on donations, ~5% on shop + Stripe ~2.9% + $0.30 |
| **TipWall** | **0%** |

TipWall's actual insight isn't "crypto tips" — it's that **a Ko-fi donation says "$5" and a TipWall tip says "$5 because your tutorial saved me hours."** The reason taxonomy (`helpful_content`, `open_source`, `tutorial`, `great_idea`, `just_support`) converts an undifferentiated payment stream into *signal the creator can act on*. That's a genuine product idea, and the dashboard's "top reason" and per-reason counts make it useful rather than decorative.

Combined with: non-custodial (funds go wallet→wallet), near-instant settlement, no account, no chargebacks, no platform that can deplatform you. That's a coherent, defensible wedge.

### Where the wedge is thin — the honest competitive read

- **Ko-fi / BMC**: zero-friction card payments and a huge existing user base. TipWall is unambiguously *worse* on convenience and better only on fees and permanence.
- **Nostr zaps (Lightning)**: this is the closest competitor and it matters. Same value4value model, same public note attached to the payment, already has a native audience, more mature. TipWall's advantages over zaps are the creator-facing analytics and the polished non-crypto-UX — not the core mechanic.
- **Brave BAT**: zero user effort, but opaque and platform-controlled.

**The differentiator that actually survives scrutiny:** 0% fee + a durable public wall + creator-owned signal analytics. Not "tipping on Nimiq."

### The funnel problem nobody wants to say out loud

**A non-crypto user cannot complete a tip without first acquiring NIM.**

The supporter journey is: click tip → install Nimiq Pay → create wallet → *buy NIM somewhere* → come back → tip. That's a 4–5 step cliff for what is fundamentally a $5 impulse. Nothing in the codebase addresses step four. There is no balance check, no "you have 0 NIM" state, no on-ramp link, no sponsored-tip fallback.

This is the single largest product risk, and it is not fixable with polish. **Notably, the competition explicitly supports USDT as well as NIM** — so a USDT tipping path is both permitted and by far the highest-leverage funnel change available.

---

## 2. What genuinely works (engineering)

This is better-engineered than most hackathon entries, and the good parts are the *boring, load-bearing* parts — which is what a senior reviewer should care about.

1. **Signature-bound ownership is done properly, not cosmetically.**
   `profile-auth.ts` is deliberately dependency-free and shared client/server so the signed message is byte-for-byte identical. The signed payload is canonical, human-readable, and ASCII-only (so `message.length` is unambiguous). Server re-derives the address from the public key — blake2b-256 → first 20 bytes → base32 → IBAN mod-97 — rather than trusting a claimed address. 5-minute TTL + single-use nonce via Redis `SET NX PX`. Handle and wallet are immutable so the binding can never be transferred. This is correct architecture.

2. **The server never trusts client-supplied identity.** `/api/tips/submit` ignores the body's `senderAddress` entirely and takes it from on-chain data. That's the right call and it's easy to get wrong.

3. **Atomic Lua where it matters.** `recordTipAtomically` does `SADD txseen → SADD vtxseen → LPUSH → LTRIM` in a single `kv.eval`. Same pattern for `setTipReply`, `addMilestone`, `markClaimClaimed`. This avoids the lost-update race a read-modify-write would have introduced on concurrent tips. Someone understood the problem.

4. **Lifetime aggregates are deliberately decoupled from the trimmed list.** `vtotal` / `vtxseen` persistent counters exist precisely because the tip list is `LTRIM`med, with NX-seeded legacy backfill. Most builders miss this entirely.

5. **The CoinGecko legacy-entry workaround is the mark of someone who debugged a real production bug.** Discovering that `nimiq` is a dead listing ~87x off while `nimiq-2` is live, then cross-checking against CoinMarketCap with a 25% divergence threshold and a liveness heuristic (`usd_24h_change` finite + market cap > $1M) — that is genuinely high-quality defensive engineering, and rare here.

6. **SSRF discipline on the OG fetcher**: protocol allowlist, private-host blocklist, `redirect: manual`, 512KB caps, 5s abort, per-URL cache *including negative caching* so a dead `contentUrl` fails fast.

7. **Graceful degradation is systematic.** Discovery, leaderboard, activity index, and tracking all fail soft. An outage never breaks tipping. That's a maturity signal.

8. **Accessibility is real, not claimed**: focus trap, `aria-modal`, `role="progressbar"` with `aria-valuenow`, 44px+ touch targets, `env(safe-area-inset-bottom)`, escape-to-close, visible focus rings.

9. **83 tests on the security-critical pure functions** — signature derivation, address encoding, tx verification, anonymous sanitization, validation. Good target selection.

10. **Three real payment paths**: mini-app SDK (in-wallet), Nimiq Hub popup (desktop browser), and scan-to-pay QR (cross-device). Genuinely thoughtful coverage of the environment matrix.

---

## 3. What doesn't work — the ruthless pass

### CRITICAL

**C1. No Nimiq address validation. At all.**
The only check on a creator's payout address is `walletStr.startsWith('NQ')`. A single typo'd character creates a wall whose tips cannot be delivered.

The bitter irony: **`verify-signature.ts` already contains a correct IBAN mod-97 checksum implementation** (`ibanCheck`) — used to *derive* addresses from public keys, but never to *validate* a creator's payout address. The correct code is sitting in the repo, ~40 lines from where it's needed.

For a product whose entire purpose is moving money, this is the highest-severity gap. Fix: extract `isValidNimiqAddress()`, call it in profile create **and** edit. Roughly an hour of work.

**C2. Scan-to-pay attribution fails silently — money moves, wall shows nothing.**
`pay-request.ts` states the design intent explicitly:

> *"The attribution nonce is only a preferred tiebreaker — Nimiq Pay's scanner may or may not carry the message field into on-chain extra_data, so we must not depend on it, or detection would never succeed."*

And `detect/route.ts` implements the opposite:

```ts
if (nonce && !nonceMatch) return NextResponse.json({ found: false })
```

The nonce is a hard gate. So if the wallet drops the `message` field, the poll never matches — the supporter has paid, the creator sees nothing, and no error surfaces anywhere. This is the worst class of bug: silent, financial, and it destroys the exact promise the product sells.

Fix: implement what the comment says (prefer nonce match, fall back to recipient + amount + freshness), and add a manual "I already paid — find my tip" reconciliation path.

**C3. The 200-tip cap silently deletes the product's core promise.**
`LTRIM key 0 199`. The wall's proposition is *"Every fan leaves a mark"*, *"Make it part of their story"*, *"a public wall of support… that last"*. At tip #201, the earliest supporter's message is **destroyed, permanently**.

And here's what makes it worse: lifetime *totals* are preserved via aggregates. So the money keeps counting up while the words that gave it meaning vanish. `DashboardExport` only exports those 200 rows, so *"Your tips are yours: download them as CSV any time"* is true only for the most recent 200.

A wall that erases its own history is not a wall. This was a pragmatic choice to bound KV reads and it has quietly become load-bearing.

**C4. Unresolvable pending tips are retried forever, on every single read.**
`reverifyPendingTips` only mutates state on `verified` or `mismatch`. A tip stuck on `unavailable` (fabricated or unindexed txHash) is **never upgraded and never removed** — so every wall GET and every dashboard GET re-runs `verifyTxDetails` at up to 6 attempts × 2 upstreams × N pending tips, with backoff, forever.

That's read amplification, latency injection, and a direct upstream-cost vector. One poisoned pending tip adds up to 12 network round-trips to *every* wall view.

### HIGH

**H1. GET endpoints perform writes.** `reverifyPendingTips` (called from both the public tips GET and the dashboard GET) and `getVerifiedTipCount` (which `SADD`s on every call, unbounded loop) both write to KV during a read. On serverless this is also a billing issue. Reconciliation belongs in a background job, not the read path.

**H2. No confirmation-depth check in tx verification.** `verifyTxDetails` matches recipient + amount (±1000 luna ≈ ±0.01 NIM) and returns `verified` without checking the transaction is in a block or has confirmations. A mempool tx that later fails is already counted, and `addVerifiedNim` has **no compensating decrement** — the lifetime aggregate has no reversal path whatsoever.

**H3. Rate limiting trusts the first `x-forwarded-for` hop.** Correct on Vercel (the platform controls the header), forgeable anywhere else. Worth documenting and hardening.

**H4. `kv.keys()` in production paths.** `getTopRefs` and several migration fallbacks do O(N) full keyspace scans. Harmless at 8 walls; a landmine at scale, and explicitly discouraged on managed Redis.

### MEDIUM

**M1. "Pledge monthly" collects an email and does nothing.** `ClaimIntent.email` is stored. There is no scheduler, no reminder, no recurrence engine. The UI offers a 🔁 toggle — a promise the backend does not keep. Ship it or hide it; a judge will find this, and so will a supporter.

**M2. No moderation.** Any supporter can attach a 64-char public message to a creator's wall. The creator can *reply* (`setTipReply`) but cannot hide or delete. For a public wall aimed at creators — who disproportionately face harassment — this is a gap, not a nice-to-have.

**M3. i18n is half-finished.** 10 languages on the supporter path, English-only dashboard/edit/analytics/explore. The README admits it, which is honest but doesn't make it score better. 1,196 lines of hardcoded strings with no pluralization, no RTL, no interpolation framework.

**M4. No wallet recovery or wall portability.** Lose the key → lose the wall, permanently (and a deletion also burns the handle via tombstone). No recovery, no delegate key, no migration. Export requires being logged in as owner and covers only the last 200 tips.

**M5. `getProfileByWallet` returns the first arbitrary match** when one wallet owns multiple handles — and this backs ownership flows.

**M6. Test coverage is well-targeted but narrow.** All 83 tests cover pure lib functions. **Zero tests on any API route, zero integration tests, and zero tests on the claim/detect/attribution logic** — which is precisely where C2 lives. Playwright is a devDependency but no E2E spec is wired into CI.

---

## 4. New-user & non-crypto onboarding — honest assessment

**New to Nimiq: moderate.** The install prompt, deep links (`nimiqpay://miniapp?url=`), store links, QR fallback, and the landing-page line *"New here? NIM is Nimiq's digital cash"* are all good. The scan-to-pay tab is a genuinely clever way to let an existing Nimiq Pay user pay from any device.

But: no balance check, no acquisition path, no "you have 0 NIM" state, and the scan-to-pay path can silently lose attribution (C2).

**Non-crypto: hard.** Installing a wallet app is a large ask for an impulse tip.

**The buried lead:** the **Nimiq Hub desktop path is the best non-crypto UX in the product** — a browser popup, no app install, works on a PC while watching a stream. But it's gated behind `nimiqAvailable === false` and labelled *"💳 Pay via Nimiq Hub"*, which is jargon to a normal person. It should be the **primary desktop CTA with plain language** ("Pay with your Nimiq wallet"), not a fallback state.

**The missing step:** the entire funnel assumes the supporter already holds NIM. Nobody has built the bridge.

---

## 5. Protocol & data architecture

**Correct calls:** non-custodial throughout (server never holds keys or funds; claim intents are pure intent records with no escrow). Signature-bound auth instead of accounts/sessions is the right model for this domain and is better executed than most. On-chain verification with explorer fallback is sound in principle. The attribution-nonce-in-`extra_data` design is clever and correctly respects Nimiq's 64-**byte** cap with UTF-8-aware trimming (not naive `slice`).

**Root cause of the two critical data bugs:** the tip model is *Redis-list-shaped* rather than *append-only-record-shaped*. `tips:{handle}` as an `LPUSH`+`LTRIM` list is a shortcut that has become load-bearing, and it produces both C3 (history deletion) and C4 (reverify-on-read amplification). A tip should be an immutable record with a stable id; the list-with-trim is the wrong substrate for a product selling permanence.

**Centralization tension worth naming:** the brand promises *"no platform, creators keep 100%"*, and that's true of the **money**. It is not true of the **history** — every tip message lives in one Vercel KV instance the creator doesn't control. If TipWall dies, walls die. `public-snapshot.ts` exists, suggesting this was recognised; it should be finished into signed, exportable, independently verifiable wall snapshots. That single change converts "MIT-licensed and forkable" into "creators own their history."

---

## 6. Hackathon judge read — scored against the actual rubric

Cycle II rubric: **45** functionality · **25** Nimiq integration · **15** real usage · **10** design/UX · **5** promotion.

| Category | Est. | Reasoning |
|---|---|---|
| **Functionality / reliability / usefulness (45)** | **34–38** | Core flow works end-to-end; real need; obvious audience; repeat value via dashboard/analytics/streaks/leaderboard; feels finished. Deductions: no address validation, silent attribution failure, 200-cap, non-functional pledge feature. |
| **Nimiq Pay + Nimiq integration (25)** | **20–23** | Mini-app SDK (connect/sign/sendTx), Hub desktop path, `nimiq:` payment URIs, RPC + explorer verification, self-broadcast relay with fallback, NIM-native throughout. The 5 pts for *"using NIM/ecosystem beyond simply accepting a payment"* are **earned** — signature-based auth, address derivation, tx verification, ecosystem stats. |
| **Real usage (15)** | **5–7** | Live and working, which beats many entries. But 8 walls / 64 tips / 19,030 NIM is near the floor. **This is the weakest category and the one that decides placement.** |
| **Design & UX (10)** | **8–9** | Cohesive "paper" identity, excellent landing page with try-before-signup demo board, accessible, mobile-first, polished modals, genuinely good micro-copy. |
| **Builder promotion checklist (5)** | **3–4** | Can't fully verify from disk, but README is strong, live badge, OG/sitemap/robots done, teaser + promo assets present in `marketing/`. |
| **TOTAL** | **~70–81 / 100** | Solidly competitive; contending for silver/bronze. |

**The strategic read:** the codebase is not the bottleneck — it's already in the top tier on 60 of the 100 points. **"Real usage" is 15 points, it's the weakest category, and it's the only one that 15 more days can materially move.** Writing more features now has a worse expected return than recruiting 20–30 real creators and driving actual tips through their walls.

---

## 7. Startup analyst read

- **Revenue: zero, by design.** The 0% promise is the brand. Post-competition options are an optional "tip the platform," premium analytics, or a take rate that contradicts the promise. Classic great-product/no-business trap — and the prize is paid over 3 months while expecting **12 months of maintenance**.
- **Defensibility: low.** MIT-licensed and fully forkable by competition rule. The only durable moat is the creator network plus indexed wall history — both currently inside one Redis instance.
- **Retention mechanics are genuinely good**: streaks, milestones, weekly leaderboard, share nudges, share kit, README badge, stream overlay, embeds. Distribution was taken seriously.
- **The honest risk:** retention depends on tip volume the product cannot generate by itself, and the supporter funnel requires crypto acquisition the product doesn't help with.

---

## 8. Prioritized roadmap

### P0 — before Sept 18 (protects money, protects the score)
1. **Nimiq address checksum validation.** Extract `ibanCheck` from `verify-signature.ts` into `isValidNimiqAddress()`; enforce on create **and** edit. ~1 hour. Highest severity-per-line in the codebase.
2. **Fix scan-to-pay attribution.** Make the nonce a tiebreaker as the comment intends; add a manual "I paid — find my tip" reconciliation path so money is never silently lost.
3. **Kill or build "pledge monthly."** Do not ship an affordance the backend doesn't honour.
4. **Drive real usage, hard.** 15 points, 15 days. Recruit 20–30 real creators, get walls live, drive real tips. **Nothing else on this list moves the score as much.**

### P1 — durability (makes the product true to its own promise)
5. Remove the 200-tip cap; **archive** old tips instead of deleting. Make export complete.
6. Stop writing during GET; move reconciliation off the read path; bound reverify attempts and add a pending-tip TTL.
7. Add confirmation-depth awareness to tx verification; give the lifetime aggregate a reversal path.
8. Moderation: let creators hide/delete tip messages.

### P2 — growth (widens the funnel)
9. **USDT support** (the competition allows USDT + NIM). Biggest available funnel-widener.
10. NIM acquisition path: balance check, "you need NIM" state, on-ramp link, sponsored-tip option.
11. Promote Nimiq Hub to the primary desktop CTA, in plain language.
12. Complete i18n across owner-facing surfaces.
13. Ship `public-snapshot.ts` into signed, portable wall snapshots — converts "forkable" into "creator-owned."

---

## 8b. Second-pass audit (infrastructure, abuse surface, dependencies)

Findings from a second sweep over the areas Part 1 didn't reach.

### NEW — HIGH

**X1. No security headers. At all.**
`next.config.ts` defines no `headers()` block, and neither does the root layout. For an app that handles wallet signatures and payments, the following are all absent:

- `Content-Security-Policy` — no XSS backstop
- `X-Frame-Options` / `frame-ancestors` — clickjacking
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`

This is ~15 lines in `next.config.ts`. There is no reason for a payments-adjacent app to ship without it. Note that the app is *also* designed to be embedded (stream overlay, `/embed/[handle]` script, iframe-friendly OG cards), so the CSP needs to be written deliberately rather than copy-pasted — but "deliberately" is not the same as "not at all."

**X2. Rate limiting covers 8 of 21 API routes — and the two most expensive endpoints are unprotected.**

Unprotected (13): `tips/[handle]` GET, `dashboard/[handle]` GET, `profile/create`, `profile/[handle]`, `profile/wallet`, `stats/[handle]`, `stats/ecosystem`, `feed/recent`, `leaderboard`, `badge/[handle]`, `og`*, `claim/[token]`, `health`.
*(`og` and `claim` do rate-limit — the earlier grep caught them. `tips/detect`, `tips/submit`, `tips/live`, `tips/reply`, `broadcast`, `claim/create`, `stats/track` all rate-limit correctly.)*

Why this matters more than the raw count suggests:

- **`/api/tips/[handle]` GET is unprotected and calls `reverifyPendingTips`.** That is the exact function from **C4**. So an attacker doesn't need to poison a pending tip and wait for organic traffic — they can hammer this endpoint directly, with no rate limit, and drive up to 12 upstream RPC round-trips per request. **X2 turns C4 from a latent cost issue into an on-demand amplification vector.**
- **`/api/stats/ecosystem` is unprotected** and is the single heaviest read in the system: it scans the profile registry, then for every wall reads `vtotal`, calls `getVerifiedTipCount` (which itself performs an unbounded `SADD` loop over that wall's tips), and reads the full tip list. `revalidate = 60` bounds it, but not against a sustained low-rate hit.
- **`/api/profile/create` is unprotected *and* doesn't validate the payout address (C1).** Together that's a wall-spam vector: unlimited profiles → polluted `profiles` registry, polluted `/explore`, and **inflated ecosystem stats** — which are the social-proof figures on your landing page and part of what a judge sees. Self-inflating the numbers you're being scored on is not a risk worth carrying.

### NEW — MEDIUM

**X3. `@nimiq/core` (27 MB on disk) is imported nowhere.**
`grep -rn "@nimiq/core" src/ scripts/` returns nothing. It is a declared dependency that is never used — and `next.config.ts` carries `serverExternalPackages: ['@nimiq/core']` to accommodate a package that never gets imported. Cargo-cult config. Remove both: one dependency, one config line, 27 MB of install weight.

For reference, the Nimiq packages *actually* used are `@nimiq/mini-app-sdk` (78 KB) and `@nimiq/hub-api` (160 KB) — and `hub-api` is correctly loaded via dynamic `import()` inside `hub.ts`, so it never touches the initial bundle. That's the right pattern and worth preserving.

**X4. No observability beyond `console.error`.**
No structured logging, no error tracking (Sentry or equivalent), no alerting, no uptime monitor. `/api/health` exists and returns a useful payload — but nothing consumes it.

This matters concretely for the competition: prizes are paid across three monthly milestones conditioned on the app being *"still live and continuously accessible"*, with *"critical bugs addressed"* at month 2. Right now you would learn the app was broken when a judge told you. A free-tier Sentry project plus a 5-minute uptime check on `/api/health` closes this in under an hour and directly de-risks months 2 and 3 of the payout.

**X5. `ShareKit` embeds `displayName` into HTML unescaped.**
```js
const embedHtml = `<a href="${url}" ...>⚡ Tip ${displayName || `@${handle}`} in NIM on TipWall</a>`
```
`displayName` is creator-controlled (≤50 chars). A name containing `<` or `"` produces a broken snippet. Severity is low — the creator pastes it into their *own* site, so it's self-inflicted — but it's a one-line escape fix and it's the kind of thing a reviewer notices.

### Verified clean (credit where due)

- **No XSS sinks.** Every user-controlled field (`tip.message`, `displayName`, `bio`, `senderName`) renders as a JSX text child and is auto-escaped. Zero `dangerouslySetInnerHTML`, zero `innerHTML` outside the Redis Lua `eval` calls. Given how much user text this app renders publicly, that's the correct outcome and worth confirming explicitly.
- **`/api/og` is properly SSRF-scoped.** It fetches *only* the URL stored on the profile resolved by handle — it is not an open fetch proxy. That's a better design than the usual implementation, and the per-IP limit backs it up.
- **`/api/tips/[handle]/reply` is fully owner-gated.** Fresh single-use `update` signature, signer address checked against the owner, `ownerPublicKey` cross-check, nonce consumption, and a rate limit. Same rigour as the profile routes. This is the pattern the other mutations should match.
- **Design system is disciplined.** 5 curated palettes driven by CSS custom properties, 385 lines of total CSS. Not a formal token architecture, but small, coherent, and easy to maintain.
- **Environment secrets are clean** — `.env*` gitignored, nothing tracked.

### Updated P0

The two new high findings slot in beside the originals:

1. **Validate Nimiq addresses** (C1)
2. **Fix scan-to-pay attribution** (C2)
3. **Rate-limit `/api/tips/[handle]`, `/api/dashboard/[handle]`, `/api/stats/ecosystem`, `/api/profile/create`** (X2) — four `checkRateLimit` calls, ~10 minutes. This is what stops C4 from being weaponisable on demand.
4. **Add security headers** (X1) — ~15 lines in `next.config.ts`
5. **Drive real usage** — still the highest-value use of the remaining two weeks

---

## 9. Bottom line

TipWall is a **genuinely well-engineered product with a real insight, undermined by two silent money bugs, a retention cap that contradicts its own promise, and an abuse surface on its most expensive endpoints.** The engineering instincts are consistently right — atomic Redis ops, server-side identity verification, no XSS sinks, graceful degradation, SSRF-scoped OG fetching, and that CoinGecko fix all say the same thing: someone here thinks about failure modes. That's rarer than it should be, and it's why the top-tier score is already within reach.

The problem isn't craft. It's that five shortcuts have quietly become load-bearing:

| # | Issue | Cost to fix |
|---|---|---|
| C1 | Unvalidated payout address | ~1 hour |
| C2 | Scan-to-pay nonce gate contradicts its own design comment — money moves, wall shows nothing | ~1 hour |
| X2 | Four expensive/unprotected endpoints; turns C4 into an on-demand amplification vector | ~10 minutes |
| X1 | No security headers on a payments app | ~15 minutes |
| C3 | 200-tip trim on a product that sells permanence | Half a day |
| — | **Real usage: 8 walls / 64 tips** | **Two weeks — and it's 15 points** |

Four of the six are same-day fixes. C3 needs real thought about the data model. The last one isn't a code problem at all.

**Sequence:** C1 + C2 + X2 + X1 in one sitting — that's most of a day and it removes every silent-failure and abuse path from the money flow. Then spend the remaining two weeks on creators, not code.
