import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | TipWall',
  description:
    'How TipWall handles data. Non-custodial, no accounts, no PII analytics. Support people and projects directly, not the platform.',
}

// TipWall is non-custodial and account-less by design, so this policy is short
// and describes what the app actually does (see README "Security model"):
// on-chain tips, signature-based ownership, anonymous funnel counters, and
// IP-based rate limiting. Update the "Last updated" date on any material change.
const LAST_UPDATED = 'August 6, 2026'

export default function PrivacyPage() {
  return (
    <div className="editorial-page">
      <div className="editorial-card">
        <h1 className="text-3xl font-bold text-[#b9382a]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#746b5e]">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 leading-relaxed text-[#4f493f]">
          <section>
            <p>
              TipWall is a non-custodial support wall that runs as a Nimiq Pay Mini App.
              It is built to collect as little about you as possible. There are no accounts, no
              passwords, and no tracking cookies. This page explains, in plain language, what
              data the app does and does not handle.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">The short version</h2>
            <ul className="list-disc space-y-2 pl-5 marker:text-[#b9382a]">
              <li>We never take custody of your funds. Tips go on-chain, supporter to wall owner.</li>
              <li>There are no user accounts and no passwords. Ownership is proven by a wallet signature.</li>
              <li>Our usage analytics are anonymous and contain no personal information.</li>
              <li>We don&apos;t sell data, run ad trackers, or set advertising cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">What a wall profile stores</h2>
            <p>
              When you create a wall, we store the profile information you choose to publish: your
              handle, display name, bio, links, and goal settings, along with your public Nimiq
              wallet address, which is used to receive tips and to verify ownership. This
              information is public by design: a tipping wall only works if people can see it.
            </p>
            <p className="mt-3">
              Creating, editing, or deleting a wall requires a fresh cryptographic signature from
              your wallet. We do not store private keys, seed phrases, or passwords. We never see
              them.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Tips and on-chain data</h2>
            <p>
              Tips are recorded only with an on-chain transaction hash and are verified against the
              Nimiq blockchain. The blockchain is a public, permanent ledger that TipWall does not
              control and cannot edit or erase. For anonymous tips, the sender&apos;s address is
              stripped from all API responses and is not shown on the supporters wall.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Analytics and abuse prevention</h2>
            <p>
              TipWall records anonymous funnel counters (for example, how many people viewed a wall
              versus opened the tip flow) so wall owners can see how their wall is performing. These
              counters contain no personally identifying information.
            </p>
            <p className="mt-3">
              To prevent spam and abuse, the app applies short-lived, IP-based rate limits to
              actions like submitting tips and creating claims. IP addresses are used only for this
              protective purpose and are not used to build a profile of you.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Deleting your wall</h2>
            <p>
              You can permanently delete your wall at any time (this is signature-gated, like every
              other owner action). Deletion erases your wall&apos;s stored profile data. On-chain
              transactions cannot be deleted, because they live on the public blockchain, not on
              TipWall.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Third parties</h2>
            <p>
              TipWall runs on hosting and key-value storage infrastructure (Vercel) and reads
              blockchain data from Nimiq network nodes and explorers. It operates inside the Nimiq
              Pay app, which has its own privacy policy that governs the wallet itself.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Changes</h2>
            <p>
              If this policy changes in a material way, the &quot;Last updated&quot; date above will
              change. Continued use of TipWall after an update means you accept the revised policy.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Terms of Service
          </Link>
          <Link href="/" className="font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Back to TipWall
          </Link>
        </div>
      </div>
    </div>
  )
}
