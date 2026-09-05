'use client'
import { useEffect, useState, useRef } from 'react'
import { type ClaimIntent, type CreatorProfile } from '@/lib/types'
import TipModal from '@/components/TipModal'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'
import { detectNimiqPay, wallUrl, isMobileDevice } from '@/lib/environment'
import { getSenderAddresses } from '@/lib/nimiq'

/**
 * Resume a preserved tip from any device. Opened via a claim link, this page
 * funnels the user into Nimiq Pay (deep link / QR) when outside, and inside
 * Nimiq Pay it auto-opens the tip modal prefilled with the claim details.
 */
export default function ClaimClient({ claim, profile }: { claim: ClaimIntent; profile: CreatorProfile }) {
  const [nimiqAvailable, setNimiqAvailable] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [done, setDone] = useState(claim.claimed)
  const [pending, setPending] = useState(false)
  const [walletBalanceNim, setWalletBalanceNim] = useState<number | null>(null)
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(false)
  const openedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    detectNimiqPay().then((available) => {
      if (cancelled) return
      setNimiqAvailable(available)
      if (!claim.claimed && !openedRef.current && (available || !isMobileDevice())) {
        openedRef.current = true
        setShowModal(true)
      }
    })
    return () => { cancelled = true }
  }, [claim.claimed])

  useEffect(() => {
    if (nimiqAvailable !== true || !showModal) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setWalletBalanceLoading(true)
      try {
        const addresses = await getSenderAddresses()
        if (addresses.length === 0) {
          if (!cancelled) setWalletBalanceNim(null)
          return
        }
        const balances = await Promise.all(addresses.map(async address => {
          try {
            const response = await fetch(`/api/wallet/balance?address=${encodeURIComponent(address)}`, { cache: 'no-store' })
            if (!response.ok) return null
            const data = await response.json() as { balanceNIM?: number }
            return typeof data.balanceNIM === 'number' ? data.balanceNIM : null
          } catch {
            return null
          }
        }))
        const available = balances.filter((balance): balance is number => typeof balance === 'number')
        if (!cancelled) setWalletBalanceNim(available.length ? Math.max(...available) : null)
      } catch {
        if (!cancelled) setWalletBalanceNim(null)
      } finally {
        if (!cancelled) setWalletBalanceLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [nimiqAvailable, showModal])

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
          Send {claim.amountNIM} NIM to support @{claim.creatorHandle}
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
          creatorDisplayName={profile.displayName}
          nimiqAvailable={nimiqAvailable}
          walletBalanceNim={walletBalanceNim}
          walletBalanceLoading={walletBalanceLoading}
          initialAmount={claim.amountNIM}
          initialMessage={claim.message}
          claimToken={claim.token}
          welcome
          onNeedsInstall={() => { setShowModal(false); setShowInstall(true) }}
          onTipSuccess={(tip) => { setShowModal(false); if (tip.pending) setPending(true); else setDone(true) }}
        />
      )}

      {(nimiqAvailable === false || showInstall) && !showModal && (
        <InstallNimiqPrompt
          creatorHandle={claim.creatorHandle}
          creatorWalletAddress={profile.walletAddress}
          amountNIM={claim.amountNIM}
          message={claim.message}
          reason={claim.reason}
          claimToken={claim.token}
          targetUrl={claimAbsoluteUrl || wallUrl(claim.creatorHandle)}
          onClose={() => setShowInstall(false)}
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
