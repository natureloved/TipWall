'use client'
import { useEffect, useState, useRef } from 'react'
import { type ClaimIntent, type CreatorProfile } from '@/lib/types'
import TipModal from '@/components/TipModal'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'
import { detectNimiqPay, wallUrl } from '@/lib/environment'

/**
 * Resume a preserved tip from any device. Opened via a claim link, this page
 * funnels the user into Nimiq Pay (deep link / QR) when outside, and inside
 * Nimiq Pay it auto-opens the tip modal prefilled with the claim details.
 */
export default function ClaimClient({ claim, profile }: { claim: ClaimIntent; profile: CreatorProfile }) {
  const [nimiqAvailable, setNimiqAvailable] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [done, setDone] = useState(claim.claimed)
  const [pending, setPending] = useState(false)
  const openedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    detectNimiqPay().then((available) => {
      if (cancelled) return
      setNimiqAvailable(available)
      if (available && !claim.claimed && !openedRef.current) {
        openedRef.current = true
        setShowModal(true)
      }
    })
    return () => { cancelled = true }
  }, [claim.claimed])

  const claimAbsoluteUrl =
    (typeof window !== 'undefined' ? window.location.href : '') ||
    `${process.env.NEXT_PUBLIC_APP_URL || ''}/claim/${claim.token}`

  if (done) {
    return (
      <Centered>
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold text-white">Tip completed!</h1>
        <p className="text-gray-300 mt-2">Thank you for supporting @{claim.creatorHandle}.</p>
        <a href={`/${claim.creatorHandle}`} className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold text-sm">
          View their wall
        </a>
      </Centered>
    )
  }

  return (
    <>
      <Centered>
        <div className="text-4xl mb-2">⚡</div>
        <h1 className="text-2xl font-bold text-white">
          Send {claim.amountNIM} NIM to @{claim.creatorHandle}
        </h1>
        {claim.message && <p className="text-gray-300 mt-2 italic">“{claim.message}”</p>}
        <p className="text-gray-400 text-sm mt-3">
          {pending
            ? 'Payment recorded. Waiting for on-chain confirmation…'
            : nimiqAvailable === null
            ? 'Checking for Nimiq Pay…'
            : nimiqAvailable
              ? 'Opening your tip…'
              : 'Open this page in Nimiq Pay to complete your tip.'}
        </p>
        {nimiqAvailable === true && !showModal && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold text-sm"
          >
            Send {claim.amountNIM} NIM
          </button>
        )}
      </Centered>

      {showModal && (
        <TipModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          creatorHandle={claim.creatorHandle}
          creatorWalletAddress={profile.walletAddress}
          nimiqAvailable={nimiqAvailable}
          initialAmount={claim.amountNIM}
          initialMessage={claim.message}
          claimToken={claim.token}
          welcome
          onNeedsInstall={() => setShowModal(false)}
          onTipSuccess={(tip) => { setShowModal(false); if (tip.pending) setPending(true); else setDone(true) }}
        />
      )}

      {nimiqAvailable === false && (
        <InstallNimiqPrompt
          creatorHandle={claim.creatorHandle}
          creatorWalletAddress={profile.walletAddress}
          amountNIM={claim.amountNIM}
          targetUrl={claimAbsoluteUrl || wallUrl(claim.creatorHandle)}
          onTipSuccess={(tip) => { if (tip.pending) setPending(true); else setDone(true) }}
        />
      )}
    </>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-page flex items-center justify-center">
      <div className="editorial-card text-center max-w-md">{children}</div>
    </div>
  )
}
