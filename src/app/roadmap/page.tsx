import Link from 'next/link'
import PlatformSupportLink from '@/components/PlatformSupportLink'

export const metadata = {
  title: 'TipWall Roadmap',
  description: 'What TipWall ships today, what is being built next, and what is still being explored.',
  openGraph: {
    title: 'TipWall Roadmap',
    description: 'What TipWall ships today, what is being built next, and what is still being explored.',
    url: 'https://tipwall.vercel.app/roadmap',
    images: [{ url: '/banner.png?v=2', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TipWall Roadmap',
    description: 'What TipWall ships today, what is being built next, and what is still being explored.',
    images: ['/banner.png?v=2'],
  },
}

/**
 * Bump this whenever the lists below change. A roadmap with no visible date is
 * indistinguishable from an abandoned one.
 */
const LAST_UPDATED = 'September 2026'

/**
 * Everything here is verifiable in the running app. This list is the actual
 * anti-vaporware argument - specifics that already work, not intentions.
 *
 * Do NOT add an item until it ships. Search in particular was nearly listed as
 * "coming soon" while it had already been live on /explore for weeks.
 */
const SHIPPED: [string, string][] = [
  ['Public support walls', 'Anyone can set up a wall, pick a link, and start receiving support. Five themes to choose from.'],
  ['Direct NIM tipping', 'Supporters pay wallet-to-wallet. TipWall never holds the money and takes 0% of it.'],
  ['On-chain verification', 'Every tip is checked against the Nimiq network before it appears. Only confirmed payments are shown or counted.'],
  ['Tip reasons', 'Supporters say why it mattered - Helpful content, Open source, Tutorial, Great idea, or Just support.'],
  ['Explore directory', 'Browse every wall, filter by category, sort by recent or most supported, and search by name or handle.'],
  ['Creator dashboard', 'Totals, supporter history, per-tip detail, milestones, and a signed export of your public history.'],
  ['Share kit', 'QR codes, downloadable posters, embeddable buttons, README badges, and rich link previews.'],
  ['Telegram notifications', 'Get pinged the moment a tip lands, with the amount and the reason attached.'],
  ['Anonymous tipping', 'Supporters can hide their name and address. The payment stays verifiable on-chain either way.'],
  ['Owner moderation', 'Hide a tip, remove a message, or reply publicly. You control what your wall shows.'],
  ['Wallet recovery', 'Nominate a recovery wallet while you still have access, so losing a device does not lose your wall.'],
  ['Five languages', 'English, Spanish, German, French, and Italian.'],
]

/**
 * Actively being worked on. No dates on purpose: a date that slips costs more
 * credibility than no date at all, and these are not committed to a release.
 */
const NEXT: [string, string][] = [
  ['Recurring support', 'Let supporters back a wall monthly instead of one tip at a time.'],
  ['Permanent proof of support', 'A collectible record for supporters who want their contribution to be part of the wall permanently.'],
  ['More assets', 'NIM is the native path and stays first-class. Wider asset support is being worked out.'],
]

/**
 * Ideas only. Nothing here is promised, and some of it may never ship.
 */
const EXPLORING: [string, string][] = [
  ['Richer creator insight', 'Turning support reasons into clearer signals about what your audience actually values.'],
  ['Discovery that fits small networks', 'Better ways to surface newer walls while a directory is still growing.'],
  ['Walls for teams', 'Splitting support across a group rather than a single wallet.'],
]

function Phase({ kicker, title, blurb, items }: {
  kicker: string; title: string; blurb: string; items: [string, string][]
}) {
  return (
    <section className="mb-10">
      <p className="landing-section-kicker">{kicker}</p>
      <h2 className="mt-3 text-2xl font-bold text-[#171614]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5f574b]">{blurb}</p>
      <ul className="mt-5 space-y-2.5">
        {items.map(([name, detail]) => (
          <li key={name} className="rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-4 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
            <p className="text-base font-bold text-[#171614]">{name}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#5f574b]">{detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function RoadmapPage() {
  return (
    <main className="editorial-page">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#171614]/25 pb-5">
          <Link href="/" className="font-serif text-2xl font-bold text-[#171614]">TipWall</Link>
          <Link href="/explore" className="text-sm font-semibold text-[#b9382a] underline underline-offset-4">Explore walls</Link>
        </header>

        <div className="mb-10">
          <p className="landing-section-kicker">Roadmap</p>
          <h1 className="mt-3 text-4xl font-bold text-[#b9382a] sm:text-5xl">What works, and what is next.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#5f574b]">
            TipWall is built in the open and shipped in small pieces. Everything under
            &ldquo;Shipped&rdquo; is live right now and you can go and check it. The rest is
            direction, not a promise.
          </p>
          <p className="mt-3 text-xs text-[#746b5e]">Last updated {LAST_UPDATED}.</p>
        </div>

        <Phase
          kicker="Live now"
          title="Shipped"
          blurb="All of this is running in the app today. If something here does not work, that is a bug, not a plan."
          items={SHIPPED}
        />
        <Phase
          kicker="In progress"
          title="Next"
          blurb="What is being built right now. No dates - a slipped date costs more trust than no date, so this stays honest instead of calendar-shaped."
          items={NEXT}
        />
        <Phase
          kicker="Not committed"
          title="Exploring"
          blurb="Ideas being considered. Some of these will happen, some will not. None of them are promised."
          items={EXPLORING}
        />

        <section className="mb-10 rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
          <h2 className="text-base font-bold text-[#171614]">Want something on here?</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5f574b]">
            If something is missing that you would actually use, say so. Requests that
            come with a real use case get built first.
          </p>
          <PlatformSupportLink />
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#171614]/25 pt-5 text-xs text-[#746b5e]">
          <span>TipWall · 0% platform fee</span>
          <span className="flex gap-3">
            <Link href="/about" className="underline underline-offset-4">Why I built this</Link>
            <Link href="/faq" className="underline underline-offset-4">FAQ</Link>
            <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4">Terms</Link>
          </span>
        </footer>
      </div>
    </main>
  )
}
