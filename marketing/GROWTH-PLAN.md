# TipWall Growth Plan — 20–30 users in 13 days

**Written:** 5 Sept 2026 · **Deadline:** Nimiq Mini Apps Competition Cycle II, **18 Sept 2026**
**Current:** 8 walls · 64 tips · 19,030 NIM · 7 funnel events tracked · live & healthy

---

## 0. Read this first: three things will waste every hour you spend

These are not marketing problems, but they will quietly drain every marketing
hour you put in. Fix them on day 1.

### Blocker 1 — USDT is switched OFF in production

`usdtPaymentsConfigured()` depends on `NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS`.
I pulled every JS chunk from the live wall page and grepped for a 40-hex contract
address: **zero matches.** The env var is empty in Vercel, so the NIM/USDT toggle
never renders (`TipModal.tsx:298`).

This matters more than anything else in this document. The NIM presets are
**25 / 100 / 250 / 500 NIM**. At the live rate of **$0.000385/NIM** that is:

| Preset | NIM | USD |
|---|---|---|
| Small | 25 | **$0.01** |
| Default | 100 | **$0.04** |
| Large | 250 | **$0.10** |
| Max | 500 | **$0.19** |

**The only path that pays real money is dead.** Switch it on or the entire
non-web3 half of this plan has nothing to offer.

**Fix:** set `NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS` **and** `POLYGON_RPC_URL`
in the Vercel project settings, then redeploy. The Polygon USDT contract is
`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`. Verify by opening any wall and
confirming the NIM/USDT tab appears. USDT presets are **$1 / $5 / $10 / $25** —
real money.

### Blocker 2 — the wall prints "≈ $0.04" next to every tip

`FiatHint` renders the live fiat value on the NIM path. A 100 NIM tip displays
**"≈ $0.04"**. You are advertising that the product is worthless at the exact
moment someone decides whether to use it.

**Fix:** on the NIM path, stop showing fiat. Show the reframe instead —
*"leaves a permanent mark"*. Keep fiat on the USDT path, where the number is
impressive. This is ~5 lines in `TipModal.tsx:366`.

### Blocker 3 — you need a Nimiq wallet before you can have a wall

`CreateWallForm` step 2 is "Connect the wallet that receives support", with
*"New to NIM? Get a wallet first"*. A non-crypto creator bounces here. There is
no way around this in the UI today.

**Marketing workaround (do this regardless):** never send a bare link. Every
single prospect gets a concierge offer — see Tactic 1. You must be present at
this step or the signup does not happen.

**Product fix (worth doing if you have a day):** allow claiming a handle with
the wallet deferred, showing "wallet not connected yet" on the wall. It converts
the hardest step into a later step.

---

## 1. The repositioning: stop selling "tipping"

At 4 cents, a NIM tip is not a payment. It is a **signature**.

- ❌ *"Tip me 4 cents"* — insulting, dead on arrival.
- ✅ *"Leave a permanent mark on my wall for less than a nickel"* — a real offer.

So sell the wall, not the tip:

> **A permanent, public, verifiable record of who backed your work and why.
> You keep 100%. No account. No platform cut.**

That positioning works on both audiences. Only the emphasis changes.

### Track A — Web3 / Nimiq natives

They already hold NIM. They do not need to be convinced that 4 cents is fine;
they understand a native token. Speak their language.

- **Lead with:** non-custodial · 0% fee · on-chain verified · Nimiq Pay mini-app · portable signed snapshot
- **Hook:** the competition. Using and being used by other entrants is mutually beneficial, and judges read an active ecosystem as real usage.
- **Where:** Nimiq Discord / Telegram / Forum, X, other Cycle II entrants
- **Ask:** create a wall, and tip three other entrants

### Track B — Non-web3 creators

They want (a) money and (b) proof that people value them. Never open with the
word crypto.

- **Lead with:** "a public wall of support — you keep 100%"
- **Money:** USDT, once Blocker 1 is fixed. $1/$5/$10/$25 is a real tip.
- **Proof:** the wall is embeddable and permanent. That is the emotional product.
- **Where:** indie hackers, Substack/Beehiiv writers, small streamers, freelancers, students, local communities, OSS maintainers
- **Ask:** create a wall, embed it, share it once

**The rule: for Track B, the wall is the product and the money is the bonus.
For Track A, the protocol guarantees are the product and the wall is the bonus.**

---

## 2. The math to 30

Define the target precisely, because "users" is ambiguous and the competition
scores *demonstrable usage*:

> **Target: 15 new walls (creators) + ~30 new tips.**
> That is 8 → 23 walls and 64 → 95 tips, and it comfortably reads as "20–30
> new users" on either definition.
> **Split: ~15 web3, ~15 non-web3.**

### Realistic conversion rates in a 13-day window

| Method | Conversion |
|---|---|
| Cold link in a channel blast | 1–3% |
| Community post that lands | 0–20 signups, high variance |
| **Personalized DM + concierge offer** | **15–30%** |
| **Warm network, direct ask** | **40–60%** |

At ~20% DM conversion, 15 creators needs **~75 serious, personalized DMs** —
about 6 per day. Very doable. Community posts and the badge channel add the rest.

**Tips follow creators.** A creator who shares once to an audience of ~200
typically gets 1–3 tips. 15 creators × 2 shares ≈ 20–40 tips. The whole game is
*get 15 creators live, then get each of them to share twice.*

### What will not work in 13 days — do not touch these

SEO · programmatic SEO · Product Hunt · paid ads · newsletter sponsorships ·
podcasts · conference talks. All of these have payback measured in months. Every
hour spent here is an hour not spent DMing, and DMing is what converts this week.

---

## 3. The tactics, ranked by return

### Tactic 1 — Concierge onboarding *(highest ROI by a wide margin)*

Never send a bare link. Every prospect gets:

> *"Pick a handle and I'll walk you through it — 5 minutes, or I'll do it with
> you on a call."*

**Why this is tactic #1:** Blocker 3 says a non-crypto creator must connect a
Nimiq wallet to create a wall. That step alone kills the signup unless you are
sitting next to them. Concierge is not a nice-to-have; it is the workaround for
an unresolved product defect.

**How to scale it:** instead of 15 separate calls, run two **"TipWall setup
hours"** — a live 60-minute window where you onboard everyone at once. Batch the
concierge, keep the conversion.

### Tactic 2 — "The First 25 Walls" founding cohort

Scarcity + identity + a real deadline, for free.

> *"I'm hand-onboarding the first 25 walls before the 18 September Nimiq
> competition deadline. After that you're on your own."*

Three things every cold pitch needs, in one line: **why now** (deadline),
**why me** (hand-onboarded, personal), **what happens if I wait** (on your own).
Costs nothing. Use it in every DM.

### Tactic 3 — The README badge *(best non-web3 channel, and it compounds)*

`/api/badge/[handle]` returns a live SVG. Verified working:

```
TipWall: tip @tipwall - 2.5k NIM
```

```markdown
[![TipWall](https://tipwall.vercel.app/api/badge/YOURHANDLE)](https://tipwall.vercel.app/YOURHANDLE)
```

**Pitch to open-source maintainers:**

> *"Your repo has 200 stars and $0 of support. Add a live badge. You keep 100%."*

Why this channel is the best of the non-web3 set:

- Maintainers are the audience that most resents a platform taking a cut — the 0% message lands hardest here.
- They are comfortable with wallets, so Blocker 3 hurts least.
- **It is "Powered by" marketing.** Every README with the badge is a permanent ad that outlives this campaign.

**Where to find them:** repos you already use and depend on, r/opensource, OSS
Discords, and — best of all — GitHub issues titled *"how can I sponsor this?"*

### Tactic 4 — The reason-signal *(your one genuinely original story)*

TipWall's real wedge: **the amount is the least interesting part of a tip. The
reason is the signal.** Aggregated reasons tell a creator *what to make more of*.
No tipping tool gives you that.

You already have real data to publish:

| Reason | Count |
|---|---|
| just_support | 47 |
| great_idea | 7 |
| helpful_content | 4 |
| tutorial | 2 |
| open_source | 2 |

**Post:** *"I built a tipping wall. 64 tips later, the money turned out to be
the least interesting part — here's what the reasons told the creators."*

This is the only content idea here with a genuine hook rather than a product
announcement, and it directly earns the competition's **5 promotion points**.

### Tactic 5 — Cross-pollinate with the competition *(highest-yield web3 channel, currently ignored)*

Every other Nimiq Mini Apps Cycle II entrant is a creator with an audience,
NIM already in their wallet, and a vested interest in an active ecosystem.
Tip them first, tell them, ask them back.

This is the warmest web3 audience that exists for you and it is sitting
untouched. 10 entrants × a genuine tip + a personal note ≈ 4–6 walls.

### Tactic 6 — Make the first share the activation event

A wall with zero tips converts terribly. A wall with three converts well. The
activation event is **the creator's first share, within 10 minutes of going
live.**

- Build the entire onboarding around getting that one share out.
- `ShareKit` already generates ready-made posts for X / Telegram / WhatsApp. Make it step one of "you're live", not an afterthought in a dashboard.
- Give them the words. Most creators will not share because they don't know what to say — hand them the script (see the copy pack).

**On seeding — be careful.** Tip creators whose work you genuinely value; that
is honest and it works. Do **not** manufacture volume by tipping your own walls
from wallets you control. Judges can see it, it corrodes the "real usage" story
you are trying to tell, and 19,030 NIM is only ~$7 — the whole ecosystem total
is small enough that sudden self-dealing is obvious.

### Tactic 7 — Per-channel attribution *(already 90% built, finish it)*

`/api/stats/track` accepts a `ref` parameter (validated `^[a-z0-9.-]{1,24}$`)
and stores it per funnel event in KV:

```
tipwall:stats:{handle}:TIP_COMPLETED:refs  →  { discord: 4, x: 2, dm: 7 }
```

**But it is not surfaced in the dashboard UI.** I grepped `DashboardStats.tsx`
and the stats routes — the data is written and never read back.

**Do this:** add `?ref=` to *every* link you send — `discord`, `x`, `reddit-oss`,
`badge`, `dm`, `telegram`. You then know which channel actually produced tips,
so you can kill the ones that don't and double down on the ones that do.
Finishing the dashboard readout is roughly 30 minutes of work.

---

## 4. Channels, ranked

| # | Channel | Track | Effort | Realistic yield |
|---|---|---|---|---|
| 1 | Warm network — personal DMs | both | high | **6–10** |
| 2 | Nimiq Discord / Telegram / Forum | web3 | med | **4–8** |
| 3 | Other Cycle II entrants | web3 | med | **3–6** |
| 4 | OSS maintainers via README badge | tech | med | **3–6** |
| 5 | X — build in public | web3 | med | **2–5** |
| 6 | Indie Hackers / creator Discords | non-web3 | med | **2–5** |
| 7 | Local & community groups | non-web3 | low | **2–4** |

Channels 1–3 are ~75% of the result. If you only have energy for two things,
do **warm DMs** and **the Nimiq community**.

---

## 5. The 13-day calendar

### Fri 5 – Sat 6 · Unblock

- [ ] **Set `NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS` + `POLYGON_RPC_URL` in Vercel. Redeploy.** Verify the NIM/USDT tab appears.
- [ ] Reframe the fiat hint on the NIM path (`TipModal.tsx:366`) — drop "≈ $0.04", show "leaves a permanent mark".
- [ ] Add `?ref=` to every outbound link; surface the ref breakdown in the dashboard.
- [ ] Write the "First 25 Walls" offer and record a 60-second setup demo.
- [ ] Publish the reason-signal post (Tactic 4).

### Sun 7 – Tue 9 · Warm network + Nimiq

- [ ] **25 personalized DMs** to your warm network. Concierge offer on every one.
- [ ] Post in Nimiq Discord / Telegram / Forum. **Tip 5 other entrants first** (Tactic 5).
- [ ] 10 OSS maintainer DMs with the badge pitch (Tactic 3).
- [ ] One X thread, build in public.

### Wed 10 – Sat 13 · Broaden

- [ ] **30 more DMs** — writers, streamers, freelancers, students.
- [ ] **First "setup hour"** — live, 60 minutes, batch the concierge (Tactic 1).
- [ ] Second X post: the reason-signal data with a bigger sample.
- [ ] Indie Hackers + creator community posts.
- [ ] **Check the ref data. Which channel converted? Double down, kill the rest.**

### Sun 14 – Thu 17 · Push + proof

- [ ] Publish *"What 30 walls taught me"* with real numbers.
- [ ] Final push: *"deadline Friday — last walls I'm hand-onboarding."*
- [ ] Second setup hour.
- [ ] Ask every creator for one more share (Tactic 6).
- [ ] Screenshot everything for the promotion submission.

### Fri 18 · Submit

---

## 6. The only three numbers to watch

Check daily. All three are already live.

1. **Walls** — `curl -s https://tipwall.vercel.app/api/stats/ecosystem` → target **8 → 23+**
2. **Tips** — same call → target **64 → 95+**
3. **Funnel per wall** — `TIP_WALL_VIEWED → TIP_COMPLETED`, broken out by `ref`. This tells you which channel is real.

If walls are rising but tips are flat, the problem is **activation, not
acquisition** — stop acquiring and go make your existing creators share.

---

## 7. Honest risks

- **NIM's price is the core strategic weakness.** At $0.000385 no creator can earn a living from NIM tips. The product is only honest as *real money* via USDT (Blocker 1). If you cannot switch USDT on, pivot Track B entirely to the social-proof angle and drop every money claim.
- **Concierge onboarding does not scale.** That is fine — you need 15 creators, not 15,000. Revisit after 18 September.
- **13 days is short.** Personal outreach is the only channel that reliably converts inside this window. Everything else here is either compounding infrastructure (the badge) or competition credit (the posts).
