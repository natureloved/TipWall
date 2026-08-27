import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - TipWall',
  description:
    'The terms for using TipWall, a non-custodial creator tipping wall on Nimiq. Tip the creator, not the platform.',
}

// Terms reflect what the app actually is: a non-custodial, no-fee, account-less
// tipping wall. Keep claims accurate to the README security model. Update the
// "Last updated" date on any material change.
const LAST_UPDATED = 'August 6, 2026'

export default function TermsPage() {
  return (
    <div className="editorial-page">
      <div className="editorial-card">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-400 mt-2">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 text-slate-300 leading-relaxed">
          <section>
            <p>
              TipWall is a free, non-custodial tool that lets creators publish a tipping wall and
              receive NIM tips inside the Nimiq Pay app. By creating a wall or using the app, you
              agree to these terms. If you don&apos;t agree, please don&apos;t use TipWall.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">What TipWall is</h2>
            <p>
              TipWall provides a shareable page and the interface to send and display on-chain
              tips. It is not a bank, a payment processor, or a custodian. Tips move directly
              between wallets on the Nimiq blockchain. TipWall never holds, controls, or has access
              to your funds, and it charges no platform fee on tips.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Your wall and your responsibility</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                You are responsible for the wallet you connect and for keeping its keys and recovery
                phrase secure. TipWall cannot recover them and never has access to them.
              </li>
              <li>
                You are responsible for the content you publish on your wall - your handle, display
                name, bio, and links - and for making sure it&apos;s lawful and doesn&apos;t
                infringe anyone&apos;s rights.
              </li>
              <li>
                You confirm that the wallet address on your wall is one you control, and that you
                aren&apos;t impersonating someone else.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Acceptable use</h2>
            <p>Don&apos;t use TipWall to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Impersonate another person, project, or brand.</li>
              <li>Publish unlawful, hateful, or infringing content.</li>
              <li>Abuse, spam, or attempt to overload or exploit the service.</li>
              <li>Misrepresent where tips go or use a wall to defraud supporters.</li>
            </ul>
            <p className="mt-3">
              We may remove a wall that violates these terms. Handles from deleted walls are
              permanently retired so they can&apos;t be re-registered or used to impersonate a
              previous owner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Tips are final</h2>
            <p>
              Blockchain transactions are irreversible. Once a tip is sent and confirmed on-chain,
              it cannot be undone by TipWall, by the creator, or by anyone else. Please send tips
              deliberately and to the intended wall.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">No warranty</h2>
            <p>
              TipWall is provided &quot;as is,&quot; without warranties of any kind. It depends on
              external systems - the Nimiq network, the Nimiq Pay app, and hosting infrastructure - that we don&apos;t control. We don&apos;t guarantee the service will always be
              available, uninterrupted, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, TipWall and its maintainers aren&apos;t liable
              for lost funds, missed tips, or any indirect or consequential damages arising from
              your use of the service, including losses from your own wallet handling or from
              transactions on the public blockchain.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Changes</h2>
            <p>
              We may update these terms as the app evolves. Material changes are reflected in the
              &quot;Last updated&quot; date above, and continued use means you accept the revised
              terms.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-amber-300 hover:text-amber-200 underline">
            Privacy Policy
          </Link>
          <Link href="/" className="text-amber-300 hover:text-amber-200 underline">
            Back to TipWall
          </Link>
        </div>
      </div>
    </div>
  )
}
