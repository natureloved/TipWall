import Link from 'next/link'
import Image from 'next/image'
import PlatformSupportLink from '@/components/PlatformSupportLink'

export const metadata = {
  title: 'Why I built TipWall',
  description: 'The story behind TipWall: why direct support matters, and why it is built on Nimiq.',
  openGraph: {
    title: 'Why I built TipWall',
    description: 'The story behind TipWall: why direct support matters, and why it is built on Nimiq.',
    url: 'https://tipwall.vercel.app/about',
    images: [{ url: '/banner.png?v=3', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why I built TipWall',
    description: 'The story behind TipWall: why direct support matters, and why it is built on Nimiq.',
    images: ['/banner.png?v=3'],
  },
}

const COPY = {
  kicker: 'Why I built this',
  title: 'I wanted to pay people back. The tools kept taking a cut.',
  lede: 'TipWall exists so that supporting someone costs nothing but the support itself, no platform in the middle, no percentage skimmed, no account to make first.',

  sections: [
    {
      heading: 'The friction was doing the talking',
      body: [
        'Every time I wanted to send someone money for something they made, something got in the way. A fee that made a small amount pointless. An account I had to create first. A minimum. A wait. A form.',
        'I would read a post that saved me an afternoon, or use a tool someone clearly poured weekends into, and there was no way to say thank you that felt worth the effort. So I did not say it. That is the part that stuck with me: not that I could not pay, but that the friction quietly talked me out of it, and nobody ever noticed.',
      ],
    },
    {
      heading: 'The moment I decided to build it',
      body: [
        'I was looking at a payout statement from a platform I used to tip a developer whose library I had relied on for months. The number that reached them was not the number I sent. The gap was not hidden, it was the business model. I sent what felt like a meaningful amount; they received what felt like a rounding error.',
        'That was the moment. Not anger, just clarity. If the act of saying thank you is taxed, fewer people say it. And the people who do say it are sending a smaller signal than they think. Every percent is a person.',
      ],
    },
    {
      heading: 'Why Nimiq',
      body: [
        'I stumbled upon the Nimiq ecosystem one day and I liked that it was designed for payments first, not speculation. NIM settles in seconds, moves wallet-to-wallet, and the fees are small enough that a tip of a few NIM still makes sense. That is rare.',
        'What it buys TipWall is simple. The money moves straight from supporter to creator. TipWall never holds anyone\u2019s money, so it never has a reason to take a cut of it  and a fee-free product is only credible when the architecture makes the fee impossible rather than generous.',
      ],
    },
    {
      heading: 'Why supporters have to say why',
      body: [
        'The reason field was the first design choice I sketched, before the wallet connection, before the themes, before anything else. I wanted the wall to be readable. A list of amounts is a leaderboard. A list of reasons is a conversation.',
        'The money is useful, it pays for time and servers and other things. But the reason is the part the creator gets to keep. "Helpful content" tells them what to make more of. "Just support" tells them someone noticed. Both matter more than the amount.',
      ],
    },
    {
      heading: 'What TipWall is not',
      body: [
        'It is not crowdfunding. There is no campaign, no funding goal you fail to hit, and no deadline that turns support into pressure. There is no pitch and no tier list.',
        'It is a wall. Someone leaves a small amount and a note, and it stays there. That is the whole idea, and it is small on purpose.',
      ],
    },
    {
      heading: 'Where it is now',
      body: [
        'TipWall is early. It is built and maintained by one person, and the walls on it are mostly people who found it through this ecosystem. That is honest. I would rather have a small number of real walls than a large number of abandoned ones.',
        'If you put up a wall and something is missing, I will probably build it. Most of the shipped features started as one person asking for something they actually needed.',
      ],
    },
  ],

  closing: {
    heading: 'If any of this is yours too',
    body: 'If you make something and want somewhere to collect support without giving a platform a slice, put up a wall. If something is missing that you would actually use, tell me, requests with a real use case get built first.',
  },

  signature: 'RastaDev',
}

export default function AboutPage() {
  return (
    <main className="editorial-page">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#171614]/25 pb-5">
          <Link href="/" className="font-serif text-2xl font-bold text-[#171614]">TipWall</Link>
          <Link href="/explore" className="text-sm font-semibold text-[#b9382a] underline underline-offset-4">Explore walls</Link>
        </header>

        <div className="mb-10">
          <p className="landing-section-kicker">{COPY.kicker}</p>
          <h1 className="mt-3 text-4xl font-bold text-[#b9382a] sm:text-5xl">{COPY.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#5f574b]">{COPY.lede}</p>
        </div>

        <div className="space-y-9">
          {COPY.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold text-[#171614]">{section.heading}</h2>
              <div className="mt-3 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="max-w-2xl text-base leading-relaxed text-[#5f574b]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
          <h2 className="text-base font-bold text-[#171614]">{COPY.closing.heading}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5f574b]">{COPY.closing.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link href="/?create=1" className="landing-btn landing-btn-dark">Put up a wall <span>→</span></Link>
            <PlatformSupportLink />
          </div>
        </section>

        <div className="mt-8 flex items-center gap-3">
          <Image src="/logo.png" alt="" width={30} height={30} />
          <span className="text-sm text-[#746b5e]">{COPY.signature}</span>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#171614]/25 pt-5 text-xs text-[#746b5e]">
          <span>TipWall · 0% platform fee</span>
          <span className="flex gap-3">
            <Link href="/roadmap" className="underline underline-offset-4">Roadmap</Link>
            <Link href="/faq" className="underline underline-offset-4">FAQ</Link>
            <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4">Terms</Link>
          </span>
        </footer>
      </div>
    </main>
  )
}
