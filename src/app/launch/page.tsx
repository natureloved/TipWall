import Link from 'next/link'

/* eslint-disable react/no-unescaped-entities */

export const metadata = {
  title: 'Tip the creator, not the platform - TipWall',
  description:
    'TipWall turns your audience’s goodwill into NIM tips - on-chain, one tap, and 100% yours. No platform cut. No accounts. Ever.',
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
          <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-400/12 border border-emerald-400/30 rounded-full px-3 py-1.5 mb-6">
            Nimiq Pay Mini App · Free Forever
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent leading-tight mb-5">
            Tip the creator,
            <br />
            not the platform.
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-7">
            <strong className="text-white">TipWall</strong> turns your audience's goodwill into NIM
            tips - on-chain, one tap, and 100% yours. No platform cut. No accounts. Ever.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold text-lg transition-all shadow-lg shadow-amber-400/20"
          >
            Create your wall →
          </Link>
          <p className="text-sm text-slate-400 mt-3">Free forever · Live in 2 minutes</p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
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

        <div className="h-px bg-slate-700 my-12 opacity-60"></div>

        {/* Problem */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-4">
            Every tip jar has the same problem: it isn't yours.
          </h2>
          <p className="text-lg text-slate-300 mb-3">
            Buy Me a Coffee and Ko-fi take a cut and hold your money. Card fees turn a $2 tip into
            $1.30. And "just send crypto to this address" gives your supporters a scary string of
            characters and gives you no page, no proof, nothing to share.
          </p>
          <p className="text-lg text-amber-300 font-semibold">
            You did the work. Your audience wants to support you. Why is a platform the one
            profiting from it?
          </p>
        </section>

        {/* Solution */}
        <section className="mt-10">
          <h2 className="text-3xl font-bold text-white mb-4">
            TipWall is your wall - and only yours.
          </h2>
          <p className="text-lg text-slate-300 mb-6">
            A shareable page where supporters tip you NIM directly. You keep every cent.
          </p>
          <ul className="space-y-4">
            {[
              {
                title: 'One tap to tip.',
                desc: 'Inside Nimiq Pay, supporting you takes a single tap - no sign-up, no account, no friction for the people who want to pay you.',
              },
              {
                title: 'Verified on-chain.',
                desc: 'Every tip is checked against the Nimiq blockchain. Not "trust me" - proof.',
              },
              {
                title: 'You keep 100%.',
                desc: 'No platform fee. The money goes creator-to-supporter, directly. We never touch it.',
              },
              {
                title: 'Yours to own, yours to leave.',
                desc: 'Ownership is a wallet signature - no passwords, no login. Want out? Delete your wall and your handle is locked forever, so no one can impersonate you.',
              },
            ].map((benefit) => (
              <li
                key={benefit.title}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
              >
                <strong className="text-amber-300 block mb-1 text-base">{benefit.title}</strong>
                <span className="text-slate-300">{benefit.desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Objection */}
        <section className="mt-10">
          <div className="bg-emerald-400/6 border border-emerald-400/25 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">
              "But my audience doesn't have Nimiq Pay yet."
            </h3>
            <p className="text-slate-300">
              Covered. Anyone without it gets a claim link and QR code that saves their tip intent,
              so no supporter hits a dead end. It's non-custodial the whole way through - nobody
              ever holds your funds, not even for a second.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-10">
          <h2 className="text-3xl font-bold text-white mb-6">How it works</h2>
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
                desc: 'Supporters tip NIM in one tap. You watch it land - live supporters wall, milestone celebrations, and a leaderboard, all built in.',
              },
            ].map((step, i) => (
              <div key={step.title} className="flex gap-4 items-start">
                <div className="flex-none w-10 h-10 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-lg">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <strong className="text-white block mb-1 text-lg">{step.title}</strong>
                  <p className="text-slate-400 text-[15px]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-10 bg-slate-800 border border-slate-700 rounded-3xl p-10 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">
            Your audience is ready to support you.
          </h2>
          <p className="text-amber-300 font-bold text-xl mb-6">Give them a wall worth tipping.</p>
          <Link
            href="/"
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold text-lg transition-all shadow-lg shadow-amber-400/20"
          >
            Create your wall →
          </Link>
          <p className="text-sm text-slate-400 mt-3">
            Free forever · No platform cut · Live in 2 minutes
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-500">
          tipwall.vercel.app ·{' '}
          <Link href="/explore" className="text-amber-300 hover:text-amber-200">
            Explore walls
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="text-amber-300 hover:text-amber-200">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="text-amber-300 hover:text-amber-200">
            Terms
          </Link>
        </div>
      </div>
    </div>
  )
}
