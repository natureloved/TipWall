'use client'

import { useState } from 'react'
import Link from 'next/link'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { nimiqAddressError, normalizeAddress, type ProfileAuthProof } from '@/lib/profile-auth'
import { useTranslations } from '@/lib/i18n'

export default function RecoveryClient({ handle }: { handle: string }) {
  const t = useTranslations()
  const [destination, setDestination] = useState('')
  const [authorizer, setAuthorizer] = useState('')
  const [auth, setAuth] = useState<ProfileAuthProof | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  const authorize = async () => {
    const target = normalizeAddress(destination)
    const addressError = nimiqAddressError(target)
    if (addressError) return setError(addressError)
    setBusy(true)
    setError('')
    try {
      const connected = normalizeAddress(await connectWallet())
      if (connected === target) throw new Error('The authorizing and destination wallets must be different.')
      const proof = await signProfileAuth({ action: 'transfer', handle, walletAddress: connected, transferTo: target })
      setAuthorizer(connected)
      setAuth(proof)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authorize recovery')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    if (!auth) return
    setBusy(true)
    setError('')
    try {
      const target = normalizeAddress(destination)
      const connected = normalizeAddress(await connectWallet())
      if (connected !== target) throw new Error('Switch to the destination wallet before signing.')
      const newOwnerAuth = await signProfileAuth({ action: 'transfer', handle, walletAddress: connected, transferTo: target })
      const res = await fetch(`/api/profile/${handle}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newWalletAddress: target, auth, newOwnerAuth }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Recovery authorization was rejected')
      setComplete(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not recover wall')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e6] p-4 text-[#171614]">
      <section className="w-full max-w-md rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-5 shadow-[5px_5px_0_#171614] sm:p-6">
        <h1 className="font-serif text-2xl font-semibold">{t('recoveryPageTitle', { handle })}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5f574b]">{t('recoveryPageBody')}</p>
        {complete ? (
          <div className="mt-5 rounded-xl border border-[#9ab6a2] bg-[#edf5ee] p-4">
            <p className="font-semibold text-[#315c3e]">{t('recoveryTransferred')}</p>
            <Link href={`/${handle}/dashboard`} className="mt-3 inline-block text-sm font-bold text-[#b9382a] underline underline-offset-4">{t('recoveryOpenDashboard')}</Link>
          </div>
        ) : (
          <>
            <label className="mt-5 block text-xs font-semibold text-[#5f574b]">{t('recoveryDestination')}</label>
            <input value={destination} onChange={event => { setDestination(event.target.value); setAuth(null); setError('') }} disabled={!!auth} className="mt-1 w-full rounded-lg border border-[#92897b] bg-[#fffdf7] p-3 font-mono text-sm focus:border-[#f05a3c] focus:outline-none" />
            {!auth ? (
              <button onClick={authorize} disabled={busy || !destination.trim()} className="mt-3 w-full rounded-xl bg-[#171614] py-3 text-sm font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] disabled:opacity-50">
                {busy ? t('recoveryWaiting') : t('recoveryAuthorize')}
              </button>
            ) : (
              <div className="mt-4">
                <p className="rounded-lg border border-[#9ab6a2] bg-[#edf5ee] p-3 text-xs text-[#315c3e]">{t('recoveryAuthorized', { address: `${authorizer.slice(0, 8)}…${authorizer.slice(-6)}` })}</p>
                <button onClick={finish} disabled={busy} className="mt-3 w-full rounded-xl bg-[#171614] py-3 text-sm font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] disabled:opacity-50">
                  {busy ? t('recoverySigningDestination') : t('recoverySignDestination')}
                </button>
                <button onClick={() => { setAuth(null); setAuthorizer('') }} className="mt-2 w-full py-2 text-xs font-semibold text-[#5f574b] underline underline-offset-4">{t('recoveryStartOver')}</button>
              </div>
            )}
          </>
        )}
        {error && <p className="mt-3 rounded-lg border border-[#d36b61] bg-[#fff0ed] p-3 text-xs font-medium text-[#8f2923]" role="alert">{error}</p>}
        <Link href={`/${handle}`} className="mt-5 inline-block text-xs font-semibold text-[#5f574b] underline underline-offset-4">{t('recoveryBackToWall')}</Link>
      </section>
    </main>
  )
}
