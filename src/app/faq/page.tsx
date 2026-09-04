import Link from 'next/link'
import PlatformSupportLink from '@/components/PlatformSupportLink'

export const metadata = {
  title: 'TipWall FAQ',
  description: 'Answers about NIM, wallets, fees, tips, confirmations, and wall ownership.',
}

const questions = [
  ['What is TipWall?', 'TipWall is a public support wall for a person, project, or community. Supporters can send NIM directly to the wall owner and leave an optional reason or message.'],
  ['Do I need an account?', 'No. TipWall uses a Nimiq wallet signature for wall ownership and does not require a username, password, or custodial account.'],
  ['What is NIM?', 'NIM is Nimiq\'s digital cash. It is sent wallet-to-wallet on the Nimiq network and usually arrives within seconds.'],
  ['Does TipWall take a fee?', 'No. TipWall takes 0% of tips. The payment goes directly to the receiving wallet. Network or wallet fees, if any, are separate from TipWall.'],
  ['Can I explore without connecting a wallet?', 'Yes. Public walls, search, categories, and the explore directory are available without a wallet. A wallet is only needed to send a tip or manage a wall.'],
  ['How are tips verified?', 'TipWall checks the transaction hash against the Nimiq network and only counts tips that match the recipient, amount, and confirmed chain inclusion.'],
  ['Can I tip anonymously?', 'Yes. Supporters can hide their address and name from the public wall. The transaction still remains verifiable on-chain.'],
  ['Can a wall owner edit or moderate their wall?', 'Yes. The owner wallet can update the profile, change its theme, reply to messages, hide content, remove public messages, and export a signed copy of the public history.'],
  ['What happens if I lose my wallet?', 'Ownership is wallet-based. Set a recovery wallet from the edit screen while you still have access, and keep a signed wall export as a portable backup.'],
  ['Can I use another asset?', 'Some walls optionally accept USDT on Polygon. NIM remains the native TipWall payment path and is available on every wall.'],
]

export default function FAQPage() {
  return (
    <main className="editorial-page">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#171614]/25 pb-5">
          <Link href="/" className="font-serif text-2xl font-bold text-[#171614]">TipWall</Link>
          <Link href="/explore" className="text-sm font-semibold text-[#b9382a] underline underline-offset-4">Explore walls</Link>
        </header>
        <div className="mb-10">
          <p className="landing-section-kicker">Help</p>
          <h1 className="mt-3 text-4xl font-bold text-[#b9382a] sm:text-5xl">Questions, answered.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#5f574b]">The short version of how walls, wallets, tips, and ownership work.</p>
        </div>
        <div className="space-y-3">
          {questions.map(([question, answer]) => (
            <details key={question} className="rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
              <summary className="cursor-pointer list-none pr-6 text-base font-bold text-[#171614]">{question}</summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5f574b]">{answer}</p>
            </details>
          ))}
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#171614]/25 pt-5 text-xs text-[#746b5e]">
          <span>TipWall · 0% platform fee</span>
          <span className="flex gap-3"><Link href="/privacy" className="underline underline-offset-4">Privacy</Link><Link href="/terms" className="underline underline-offset-4">Terms</Link><PlatformSupportLink /></span>
        </footer>
      </div>
    </main>
  )
}
