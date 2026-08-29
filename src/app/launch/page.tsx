import Link from 'next/link'

/* eslint-disable react/no-unescaped-entities */

export const metadata = {
  title: 'Tip the creator, not the platform | TipWall',
  description:
    'TipWall turns your audience’s goodwill into NIM tips. On-chain, one tap, and 100% yours. No platform cut. No accounts. Ever.',
  openGraph: {
    title: 'Tip the creator, not the platform',
    description:
      'A Nimiq Pay Mini App where supporters tip you NIM directly. You keep 100%. Free forever.',
    url: 'https://tipwall.vercel.app/launch',
    images: [{ url: '/banner.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tip the creator, not the platform',
    description:
      'A Nimiq Pay Mini App where supporters tip you NIM directly. You keep 100%. Free forever.',
    images: ['/banner.png'],
  },
}

export default function LaunchPage() {
  return (
    <div className="editorial-page">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-block rounded-full border border-[#7d9b85] bg-[#e7f0e7] px-3 py-1.5 mb-6 text-[11px] font-bold uppercase tracking-wider text-[#315c3b]">
            Nimiq Pay Mini App · Free Forever
          </div>
          <h1 className="mb-5 text-4xl sm:text-5xl font-bold leading-tight text-[#b9382a]">
            Tip the creator,
            <br />
            not the platform.
          </h1>
          <p className="mx-auto mb-7 max-w-2xl text-lg sm:text-xl text-[#5f574b]">
            <strong className="text-[#171614]">TipWall</strong> turns your audience's goodwill into NIM
            tips. On-chain, one tap, and 100% yours. No platform cut. No accounts. Ever.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl border-2 border-[#171614] bg-[#f05a3c] px-8 py-4 text-lg font-bold text-[#171614] shadow-[4px_4px_0_#171614] transition hover:bg-[#ff7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171614] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e6]"
          >
            Create your wall
          </Link>
          <p className="mt-3 text-sm text-[#746b5e]">Free forever · Live in 2 minutes</p>

          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-[#171614] bg-[#171614] text-[#fffdf7] shadow-[6px_6px_0_rgba(23,22,20,0.18)]">
            <video
              className="block w-full"
              controls
              playsInline
              preload="metadata"
              poster="/promo/screenshot-wall.png"
              aria-label="TipWall product demonstration"
            >
              <source src="/promo/demo.mp4" type="video/mp4" />
              Your browser does not support embedded video. You can open the demo directly at /promo/demo.mp4.
            </video>
          </div>
        </div>

        <div className="my-12 h-px bg-[#171614]/25"></div>

        {/* Problem */}
        <section>
          <h2 className="mb-4 text-3xl font-bold text-[#171614]">
            Every tip jar has the same problem: it isn't yours.
          </h2>
          <p className="mb-3 text-lg text-[#5f574b]">
            Buy Me a Coffee and Ko-fi take a cut and hold your money. Card fees turn a $2 tip into
            $1.30. And "just send crypto to this address" gives your supporters a scary string of
            characters and gives you no page, no proof, nothing to share.
          </p>
          <p className="text-lg font-semibold text-[#b9382a]">
            You did the work. Your audience wants to support you. Why is a platform the one
            profiting from it?
          </p>
        </section>

        {/* Solution */}
        <section className="mt-10">
          <h2 className="mb-4 text-3xl font-bold text-[#171614]">
            TipWall is your wall, and only yours.
          </h2>
          <p className="mb-6 text-lg text-[#5f574b]">
            A shareable page where supporters tip you NIM directly. You keep every cent.
          </p>
          <ul className="space-y-4">
            {[
              {
                title: 'One tap to tip.',
                desc: 'Inside Nimiq Pay, supporting you takes a single tap. No sign-up, no account, no friction for the people who want to pay you.',
              },
              {
                title: 'Verified on-chain.',
                desc: 'Every tip is checked against the Nimiq blockchain. Not "trust me". Proof.',
              },
              {
                title: 'You keep 100%.',
                desc: 'No platform fee. The money goes creator-to-supporter, directly. We never touch it.',
              },
              {
                title: 'Yours to own, yours to leave.',
                desc: 'Ownership is a wallet signature. No passwords, no login. Want out? Delete your wall and your handle is locked forever, so no one can impersonate you.',
              },
            ].map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]"
              >
                <strong className="mb-1 block text-base text-[#b9382a]">{benefit.title}</strong>
                <span className="text-[#5f574b]">{benefit.desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Objection */}
        <section className="mt-10">
          <div className="rounded-2xl border border-[#7d9b85] bg-[#e7f0e7] p-6">
            <h3 className="mb-3 text-xl font-bold text-[#315c3b]">
              "But my audience doesn't have Nimiq Pay yet."
            </h3>
            <p className="text-[#425b49]">
              Covered. Anyone without it gets a claim link and QR code that saves their tip intent,
              so no supporter hits a dead end. It's non-custodial the whole way through. Nobody
              ever holds your funds, not even for a second.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-10">
          <h2 className="mb-6 text-3xl font-bold text-[#171614]">How it works</h2>
          <div className="space-y-5">
            {[
              {
                title: 'Create your wall.',
                desc: 'Connect your wallet, pick a handle, add your bio. Two minutes, signature-based, no password.',
              },
              {
                title: 'Share it anywhere.',
                desc: 'Drop your link, QR, or README badge in your bio, stream, repo, or newsletter. TipWall gives you the share kit.',
              },
              {
                title: 'Get tipped.',
                desc: 'Supporters tip NIM in one tap. You watch it land with a live supporters wall, milestone celebrations, and a leaderboard, all built in.',
              },
            ].map((step, i) => (
              <div key={step.title} className="flex gap-4 items-start">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[#171614] bg-[#f6b221] text-lg font-bold text-[#171614]">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <strong className="mb-1 block text-lg text-[#171614]">{step.title}</strong>
                  <p className="text-[15px] text-[#5f574b]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-10 rounded-3xl border-2 border-[#171614] bg-[#fff1eb] p-6 text-center shadow-[6px_6px_0_#171614] sm:p-10">
          <h2 className="mb-2 text-3xl font-bold text-[#171614]">
            Your audience is ready to support you.
          </h2>
          <p className="mb-6 text-xl font-bold text-[#b9382a]">Give them a wall worth tipping.</p>
          <Link
            href="/"
            className="inline-block rounded-xl border-2 border-[#171614] bg-[#f05a3c] px-8 py-4 text-lg font-bold text-[#171614] shadow-[4px_4px_0_#171614] transition hover:bg-[#ff7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171614] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff1eb]"
          >
            Create your wall
          </Link>
          <p className="mt-3 text-sm text-[#746b5e]">
            Free forever · No platform cut · Live in 2 minutes
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-[#746b5e]">
          tipwall.vercel.app ·{' '}
          <Link href="/explore" className="font-semibold text-[#b9382a] underline-offset-4 hover:text-[#171614] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Explore walls
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="font-semibold text-[#b9382a] underline-offset-4 hover:text-[#171614] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="font-semibold text-[#b9382a] underline-offset-4 hover:text-[#171614] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Terms
          </Link>
        </div>
      </div>
    </div>
  )
}
