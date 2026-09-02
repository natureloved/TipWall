'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeHandle } from '@/lib/profile-auth'
import { CREATOR_CATEGORIES, type CreatorCategory } from '@/lib/types'
import MissionLink from '@/components/MissionLink'
import FirstVisitIntro from '@/components/FirstVisitIntro'
import EcosystemStats from '@/components/EcosystemStats'
import LiveSignalCard from '@/components/LiveSignalCard'
import RecentActivity from '@/components/RecentActivity'

type DemoNote = { text: string; from: string; reason: string; amount?: string; color: string; rotate: string; top: string; left: string }

const notes: DemoNote[] = [
  { text: 'Your tutorial saved me hours.', from: '@lena', reason: 'Helpful content', amount: '10 NIM', color: '#fff1b8', rotate: '-3deg', top: '15%', left: '8%' },
  { text: 'Keep building. This is a great idea.', from: '@sam', reason: 'Great idea', amount: '25 NIM', color: '#ffd5c8', rotate: '3deg', top: '47%', left: '53%' },
  { text: 'The clearest explanation on the web.', from: '@obi', reason: 'Tutorial', amount: '15 NIM', color: '#d8e9dd', rotate: '-4deg', top: '58%', left: '9%' },
  { text: 'Cheering you on from day one.', from: '@mira', reason: 'Keep going', amount: '50 NIM', color: '#d9eaf0', rotate: '4deg', top: '10%', left: '56%' },
]

function AppreciationBoard({ onCreate }: { onCreate: () => void }) {
  const [message, setMessage] = useState('')
  const [posted, setPosted] = useState(false)
  const [pinned, setPinned] = useState<DemoNote | null>(null)
  const pin = () => {
    const text = message.trim()
    if (!text) return
    setPinned({ text, from: 'you', reason: 'Appreciation', color: '#ffe9a8', rotate: '2deg', top: '35%', left: '31%' })
    setMessage('')
    setPosted(true)
  }
  return <div className="landing-board-wrap">
    <div className="landing-board" aria-label="Example TipWall appreciation board">
      <div className="landing-board-strip"><span><i className="landing-live-dot" /> Example wall</span><span>maya.builds</span></div>
      <div className="board-title">People leave a little<br /><em>something behind.</em></div>
      {[...notes, ...(pinned ? [pinned] : [])].map((note) => <article key={note.from} className="landing-note" style={{ '--note-top': note.top, '--note-left': note.left, '--note-rotate': note.rotate, '--note-color': note.color } as React.CSSProperties}>
        <div className="landing-tape" />
        <p>{note.text}</p>
        <footer><span>{note.from} · {note.reason}</span>{note.amount && <strong>{note.amount}</strong>}</footer>
      </article>)}
      <div className="landing-board-mark"><Image src="/logo.svg" alt="" width={30} height={30} /> TipWall</div>
    </div>
    <div className="landing-pin-form">
      <label htmlFor="demo-note">Try it: leave a note</label>
      <textarea id="demo-note" maxLength={90} value={message} onChange={(e) => { setMessage(e.target.value); setPosted(false) }} placeholder="Tell a creator why their work mattered..." rows={2} />
      <div className="landing-pin-row"><span>{message.length}/90</span><button type="button" onClick={pin}>{posted ? 'Pinned ✓' : 'Pin a note →'}</button></div>
      {pinned && <p className="landing-pin-nudge">Pinned to the board. This wall is just a demo. <button type="button" onClick={onCreate}>Create your real wall below →</button></p>}
    </div>
  </div>
}

const PLACEHOLDER_TEXT = 'e.g. "Building an AI agent"'

export default function HomePage() {
  const [handle, setHandle] = useState(''); const [wallet, setWallet] = useState(''); const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState(''); const [bio, setBio] = useState(''); const [achievement, setAchievement] = useState(''); const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [showDetails, setShowDetails] = useState(false)
  const [handleStatus, setHandleStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle'); const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null); const setupRef = useRef<HTMLFormElement>(null)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { const normalized = normalizeHandle(handle); if (normalized.length < 3) { setHandleStatus('idle'); return }; setHandleStatus('checking'); if (checkTimeout.current) clearTimeout(checkTimeout.current); checkTimeout.current = setTimeout(async () => { try { const res = await fetch(`/api/profile/${normalized}`); setHandleStatus(res.status === 404 ? 'available' : 'taken') } catch { setHandleStatus('idle') } }, 400); return () => { if (checkTimeout.current) clearTimeout(checkTimeout.current) } }, [handle])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (new URLSearchParams(window.location.search).get('create') === '1') requestAnimationFrame(() => setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }, [])
  const handleConnect = async () => { setError(null); setConnecting(true); try { setWallet(await connectWallet()) } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect wallet') } finally { setConnecting(false) } }
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(null); const handleStr = normalizeHandle(handle); if (handleStr.length < 3) return setError('Handle must be at least 3 characters'); if (!wallet) return setError('Connect your Nimiq wallet first'); setSubmitting(true); try { const auth = await signProfileAuth({ action: 'create', handle: handleStr, walletAddress: wallet }); const res = await fetch('/api/profile/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: handleStr, walletAddress: wallet, displayName: displayName || handleStr, bio, achievement: achievement || undefined, category: category || undefined, auth }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); window.location.href = `/${data.handle}/share?new=1` } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create profile'); setSubmitting(false) } }
  const normalizedHandle = normalizeHandle(handle)
  return <main className="landing-page">
    <header className="landing-header"><Link href="/" className="landing-logo"><Image src="/logo.svg" alt="TipWall logo" width={38} height={38} /><span>TipWall</span></Link><nav><Link href="/explore"><span className="nav-full">Explore creators</span><span className="nav-short">Explore</span></Link><button onClick={() => setupRef.current?.scrollIntoView({ behavior: 'smooth' })}><span className="nav-full">Create a wall</span><span className="nav-short">Create</span> <span>↗</span></button></nav></header>
    <aside className="landing-supporter-line" aria-label="Support a creator">Just here to support someone? <Link href="/explore">Find their wall →</Link></aside>
    <RecentActivity />
    <section className="landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow"><i className="landing-live-dot" /> SUPPORT THAT SAYS SOMETHING</p><h1>Every fan<br />leaves a <em>mark.</em></h1><p className="landing-lede">Tip creators directly in NIM, and leave the reason it mattered. A public wall of support, insight, and tiny moments that last.</p><div className="landing-actions"><button className="landing-btn landing-btn-dark" onClick={() => setupRef.current?.scrollIntoView({ behavior: 'smooth' })}>Make your wall <span>↗</span></button><Link className="landing-btn landing-btn-light" href="/explore">Explore walls <span>→</span></Link></div><div className="landing-trust"><span>No fees, ever</span><span>Creators keep 100%</span><span>Tips arrive in seconds</span></div><p className="landing-nim-note">New here? <strong>NIM</strong> is Nimiq&apos;s digital cash. Fans send it straight to a creator&apos;s wallet in seconds, no account needed.</p></div><AppreciationBoard onCreate={() => setupRef.current?.scrollIntoView({ behavior: 'smooth' })} /></section>
    <section className="landing-section landing-three"><div><p className="landing-section-kicker">A better kind of support</p><h2>Money is useful.<br /><em>Meaning is memorable.</em></h2></div><div className="landing-steps"><div><b>01</b><h3>Find someone worth backing</h3><p>Browse real creator walls and discover work you want to see more of.</p></div><div><b>02</b><h3>Tip with a reason</h3><p>Choose a signal like Helpful content, Tutorial, or Great idea.</p></div><div><b>03</b><h3>Make it part of their story</h3><p>Your NIM goes straight to their wallet. Your words stay on the wall.</p></div></div></section>
    <section className="landing-insight"><div><p className="landing-section-kicker">What creators learn</p><h2>Your audience is telling you<br /><em>what to make next.</em></h2><p>Every reason becomes a signal. See whether people support your tutorials, your ideas, or simply the fact that you keep showing up.</p><Link href="/explore" className="landing-text-link">See creator walls →</Link></div><LiveSignalCard /></section>
    <section className="landing-create"><div><p className="landing-section-kicker">Ready when you are</p><h2>Put your name<br /><em>on the wall.</em></h2><p>Set up a TipWall in under a minute. Connect your Nimiq wallet, claim your handle, and start collecting meaningful support.</p></div><form ref={setupRef} onSubmit={submit} className="landing-form"><h3>Create your TipWall</h3><p className="landing-form-sub">Start with the essentials. Add the rest later.</p><label>Handle <span>tipwall.vercel.app/</span><input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="yourname" required /></label>{normalizedHandle.length >= 3 && <small className={handleStatus === 'available' ? 'ok' : handleStatus === 'taken' ? 'bad' : ''}>{handleStatus === 'checking' ? 'Checking…' : handleStatus === 'available' ? '✓ This handle is available' : handleStatus === 'taken' ? '✕ This handle is taken' : ''}</small>}<label>Nimiq wallet{wallet ? <div className="landing-wallet">{wallet.slice(0, 12)}…{wallet.slice(-8)} <b>✓</b></div> : <button type="button" className="landing-wallet-btn" onClick={handleConnect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect Nimiq Wallet'}</button>} </label><button type="button" className="landing-details" onClick={() => setShowDetails(v => !v)}>{showDetails ? '− Hide optional details' : '+ Add details (optional)'}</button>{showDetails && <div className="landing-optional"><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Choose later</option>{(Object.keys(CREATOR_CATEGORIES) as CreatorCategory[]).map(c => <option key={c} value={c}>{CREATOR_CATEGORIES[c].emoji} {CREATOR_CATEGORIES[c].label}</option>)}</select></label><label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" /></label><label>Bio<textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} /></label><label>What are you working on?<input value={achievement} onChange={e => setAchievement(e.target.value)} placeholder={PLACEHOLDER_TEXT} maxLength={80} /></label></div>}{error && <p className="landing-error">{error}</p>}<button className="landing-btn landing-btn-dark landing-submit" disabled={submitting || handleStatus === 'taken'}>{submitting ? 'Sign in wallet…' : 'Create TipWall ↗'}</button><p className="landing-form-foot"><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p></form></section>
    <EcosystemStats /><footer className="landing-footer"><Link href="/" className="landing-logo"><Image src="/logo.svg" alt="TipWall logo" width={30} height={30} /><span>TipWall</span></Link><MissionLink labelKey="learnAboutTipWall" variant="home" /><span>Built for creators on Nimiq · 0% platform fee</span></footer>
    <FirstVisitIntro variant="home" onClose={() => {}} />
  </main>
}
