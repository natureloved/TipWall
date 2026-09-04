import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | TipWall',
  description:
    'The terms for using TipWall, a non-custodial support wall on Nimiq. Support people and projects directly, not the platform.',
}

// Terms reflect what the app actually is: a non-custodial, no-fee, account-less
// tipping wall. Keep claims accurate to the README security model. Update the
// "Last updated" date on any material change.
const LAST_UPDATED = 'August 6, 2026'

export default function TermsPage() {
  return (
    <div className="editorial-page">
      <div className="editorial-card">
        <h1 className="text-3xl font-bold text-[#b9382a]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[#746b5e]">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 leading-relaxed text-[#4f493f]">
          <section>
            <p>
              TipWall is a free, non-custodial tool that lets people, projects, and communities publish a support wall and
              receive NIM tips inside the Nimiq Pay app. By creating a wall or using the app, you
              agree to these terms. If you don&apos;t agree, please don&apos;t use TipWall.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">What TipWall is</h2>
            <p>
              TipWall provides a shareable page and the interface to send and display on-chain
              tips. It is not a bank, a payment processor, or a custodian. Tips move directly
              between wallets on the Nimiq blockchain. TipWall never holds, controls, or has access
              to your funds, and it charges no platform fee on tips.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Your wall and your responsibility</h2>
            <ul className="list-disc space-y-2 pl-5 marker:text-[#b9382a]">
              <li>
                You are responsible for the wallet you connect and for keeping its keys and recovery
                phrase secure. TipWall cannot recover them and never has access to them.
              </li>
              <li>
                You are responsible for the content you publish on your wall: your handle, display
                name, bio, and links, and for making sure it&apos;s lawful and doesn&apos;t
                infringe anyone&apos;s rights.
              </li>
              <li>
                You confirm that the wallet address on your wall is one you control, and that you
                aren&apos;t impersonating someone else.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Acceptable use</h2>
            <p>Don&apos;t use TipWall to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-[#b9382a]">
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
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Tips are final</h2>
            <p>
              Blockchain transactions are irreversible. Once a tip is sent and confirmed on-chain,
              it cannot be undone by TipWall, by the wall owner, or by anyone else. Please send tips
              deliberately and to the intended wall.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">No warranty</h2>
            <p>
              TipWall is provided &quot;as is,&quot; without warranties of any kind. It depends on
              external systems such as the Nimiq network, the Nimiq Pay app, and hosting infrastructure that we don&apos;t control. We don&apos;t guarantee the service will always be
              available, uninterrupted, or error-free.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, TipWall and its maintainers aren&apos;t liable
              for lost funds, missed tips, or any indirect or consequential damages arising from
              your use of the service, including losses from your own wallet handling or from
              transactions on the public blockchain.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#171614]">Changes</h2>
            <p>
              We may update these terms as the app evolves. Material changes are reflected in the
              &quot;Last updated&quot; date above, and continued use means you accept the revised
              terms.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Privacy Policy
          </Link>
          <Link href="/" className="font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
            Back to TipWall
          </Link>
        </div>
      </div>
    </div>
  )
}
