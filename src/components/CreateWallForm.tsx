'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Link from 'next/link'
import Image from 'next/image'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeHandle, nimiqAddressError } from '@/lib/profile-auth'
import { CREATOR_CATEGORIES, type CreatorCategory } from '@/lib/types'
import { buildNimiqPayDeepLink, detectNimiqPay, isMobileDevice, NIMIQ_PAY_LANDING_URL } from '@/lib/environment'

type Step = 1 | 2 | 3

const SOCIAL_FIELDS = [
  ['website', 'Website'],
  ['x', 'X profile'],
  ['github', 'GitHub'],
  ['telegram', 'Telegram'],
] as const

export default function CreateWallForm() {
  const [step, setStep] = useState<Step>(1)
  const [handle, setHandle] = useState('')
  const [wallet, setWallet] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [achievement, setAchievement] = useState('')
  const [category, setCategory] = useState<CreatorCategory | ''>('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({})
  const [usdtPolygonAddress, setUsdtPolygonAddress] = useState('')
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [inNimiqPay, setInNimiqPay] = useState<boolean | null>(null)
  const [handoffQr, setHandoffQr] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const normalizedHandle = normalizeHandle(handle)
  const createUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://tipwall.vercel.app'}/?create=1`
  const deepLink = buildNimiqPayDeepLink(createUrl)

  useEffect(() => {
    detectNimiqPay().then(setInNimiqPay)
  }, [])

  useEffect(() => {
    if (inNimiqPay !== false) return
    QRCode.toDataURL(deepLink, { width: 220, margin: 1, color: { dark: '#171614', light: '#ffffff' } })
      .then(setHandoffQr).catch(() => setHandoffQr(''))
  }, [deepLink, inNimiqPay])

  useEffect(() => {
    let cancelled = false
    if (normalizedHandle.length < 3) {
      // The validation state follows the normalized input and is intentionally
      // reset as soon as the user removes an incomplete handle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHandleStatus('idle')
      return
    }
    setHandleStatus('checking')
    if (checkTimeout.current) clearTimeout(checkTimeout.current)
    checkTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/${normalizedHandle}`)
        if (cancelled) return
        setHandleStatus(res.status === 404 ? 'available' : 'taken')
      } catch {
        if (cancelled) return
        setHandleStatus('idle')
      }
    }, 350)
    return () => {
      cancelled = true
      if (checkTimeout.current) clearTimeout(checkTimeout.current)
    }
  }, [normalizedHandle])

  const nextFromHandle = () => {
    setError(null)
    if (normalizedHandle.length < 3) return setError('Handle must be at least 3 characters')
    if (handleStatus === 'taken') return setError('That handle is already taken')
    if (handleStatus !== 'available') return setError('Checking handle availability...')
    setStep(2)
  }

  const connectOwnerWallet = async () => {
    setError(null)
    setConnecting(true)
    try {
      setWallet(await connectWallet())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect wallet')
    } finally {
      setConnecting(false)
    }
  }

  const nextFromWallet = () => {
    setError(null)
    const walletError = nimiqAddressError(wallet)
    if (walletError) return setError(walletError)
    setStep(3)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!wallet) return setError('Connect your Nimiq wallet first')
    setSubmitting(true)
    try {
      const auth = await signProfileAuth({ action: 'create', handle: normalizedHandle, walletAddress: wallet })
      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizedHandle,
          walletAddress: wallet,
          displayName: displayName || normalizedHandle,
          bio,
          achievement: achievement || undefined,
          category: category || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          socialLinks,
          usdtPolygonAddress: usdtPolygonAddress.trim() || undefined,
          auth,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create wall')
      window.location.href = `/${data.handle}/share?new=1`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wall')
      setSubmitting(false)
    }
  }

  const updateSocial = (key: string, value: string) => setSocialLinks(current => ({ ...current, [key]: value }))

  return (
    <form onSubmit={submit} className="landing-form">
      <div className="create-form-heading">
        <div>
          <h3>Create your support wall</h3>
          <p className="landing-form-sub">Three quick steps. You can add more detail later.</p>
        </div>
        <span className="create-step-count">{step}/3</span>
      </div>
      <div className="create-progress" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map(item => <span key={item} className={item <= step ? 'is-active' : ''} />)}
      </div>

      {step === 1 && (
        <section className="create-step" aria-labelledby="create-step-one">
          <p id="create-step-one" className="create-step-label">1. Choose your link</p>
          <label>Handle <span>tipwall.vercel.app/</span>
            <input value={handle} onChange={event => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="yourname" autoComplete="username" maxLength={32} required />
          </label>
          {normalizedHandle.length >= 3 && <small className={handleStatus === 'available' ? 'ok' : handleStatus === 'taken' ? 'bad' : ''}>{handleStatus === 'checking' ? 'Checking...' : handleStatus === 'available' ? 'This handle is available' : handleStatus === 'taken' ? 'This handle is taken' : ''}</small>}
          <p className="create-step-help">This becomes your public TipWall link. Use your name, project, community, or anything people will recognize.</p>
          <button type="button" className="landing-btn landing-btn-dark landing-submit" onClick={nextFromHandle}>Continue to wallet <span>→</span></button>
        </section>
      )}

      {step === 2 && (
        <section className="create-step" aria-labelledby="create-step-two">
          <p id="create-step-two" className="create-step-label">2. Connect the wallet that receives support</p>
          {wallet ? (
            <div className="landing-wallet">{wallet.slice(0, 12)}...{wallet.slice(-8)} <b>✓</b></div>
          ) : inNimiqPay === false ? (
            <div className="create-handoff">
              <p>Wallet signatures happen inside Nimiq Pay. Open this page there, then come back to step 2.</p>
              {isMobileDevice() ? <a href={deepLink} className="landing-btn landing-btn-dark landing-submit">Open in Nimiq Pay <span>↗</span></a> : <>{handoffQr && <Image src={handoffQr} alt="Scan to open TipWall in Nimiq Pay" width={220} height={220} unoptimized />}<p className="create-step-help">Scan this code with your phone to continue in Nimiq Pay.</p></>}
              <a href={NIMIQ_PAY_LANDING_URL} target="_blank" rel="noopener noreferrer" className="create-inline-link">New to NIM? Get a wallet first</a>
            </div>
          ) : (
            <button type="button" className="landing-wallet-btn" onClick={connectOwnerWallet} disabled={connecting || inNimiqPay === null}>{inNimiqPay === null ? 'Checking wallet...' : connecting ? 'Connecting...' : 'Connect Nimiq Wallet'}</button>
          )}
          {wallet && <p className="create-step-help">This wallet owns the wall and receives tips directly. TipWall never holds your funds.</p>}
          <div className="create-step-actions"><button type="button" className="create-back" onClick={() => setStep(1)}>Back</button><button type="button" className="landing-btn landing-btn-dark landing-submit" onClick={nextFromWallet} disabled={!wallet}>Continue to profile <span>→</span></button></div>
        </section>
      )}

      {step === 3 && (
        <section className="create-step" aria-labelledby="create-step-three">
          <p id="create-step-three" className="create-step-label">3. Make it yours <span>(optional)</span></p>
          <div className="create-profile-grid">
            <label>Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name or project" /></label>
            <label>Avatar URL<input value={avatarUrl} onChange={event => setAvatarUrl(event.target.value)} placeholder="https://..." inputMode="url" /></label>
          </div>
          <label>Bio<textarea value={bio} onChange={event => setBio(event.target.value)} rows={3} placeholder="What do you make, build, teach, or bring to the community?" /></label>
          <label>Category<select value={category} onChange={event => setCategory(event.target.value as CreatorCategory | '')}><option value="">Choose later</option>{(Object.keys(CREATOR_CATEGORIES) as CreatorCategory[]).map(value => <option key={value} value={value}>{CREATOR_CATEGORIES[value].emoji} {CREATOR_CATEGORIES[value].label}</option>)}</select></label>
          <label>What are you working on?<input value={achievement} onChange={event => setAchievement(event.target.value)} placeholder="e.g. Building an AI agent" maxLength={80} /></label>
          <div className="create-social-fields"><p className="create-field-caption">Links people can use to find you</p>{SOCIAL_FIELDS.map(([key, label]) => <label key={key}>{label}<input value={socialLinks[key] || ''} onChange={event => updateSocial(key, event.target.value)} placeholder="https://..." inputMode="url" /></label>)}</div>
          <label>USDT Polygon wallet <span>optional</span><input value={usdtPolygonAddress} onChange={event => setUsdtPolygonAddress(event.target.value)} placeholder="0x..." /></label>
          <div className="create-step-actions"><button type="button" className="create-back" onClick={() => setStep(2)}>Back</button><button className="landing-btn landing-btn-dark landing-submit" disabled={submitting}>{submitting ? 'Signing in wallet...' : 'Create support wall ↗'}</button></div>
        </section>
      )}
      {error && <p className="landing-error" role="alert">{error}</p>}
      <p className="landing-form-foot">You can edit your profile, links, and theme after launch. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
    </form>
  )
}
