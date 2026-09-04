'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import MissionLink from '@/components/MissionLink'
import EcosystemStats from '@/components/EcosystemStats'
import LiveSignalCard from '@/components/LiveSignalCard'
import RecentActivity from '@/components/RecentActivity'
import PlatformSupportLink from '@/components/PlatformSupportLink'
import CreateWallForm from '@/components/CreateWallForm'

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
    <div className="landing-board" aria-label="Example support wall">
      <div className="landing-board-strip"><span><i className="landing-live-dot" /> Example wall</span><span>maya.builds</span></div>
      <div className="board-title">People leave a little<br /><em>something behind.</em></div>
      {[...notes, ...(pinned ? [pinned] : [])].map(note => <article key={note.from} className="landing-note" style={{ '--note-top': note.top, '--note-left': note.left, '--note-rotate': note.rotate, '--note-color': note.color } as CSSProperties}>
        <div className="landing-tape" />
        <p>{note.text}</p>
        <footer><span>{note.from} · {note.reason}</span>{note.amount && <strong>{note.amount}</strong>}</footer>
      </article>)}
      <div className="landing-board-mark"><Image src="/logo.svg" alt="" width={30} height={30} /> TipWall</div>
    </div>
    <div className="landing-pin-form">
      <label htmlFor="demo-note">Try it: leave a note</label>
      <textarea id="demo-note" maxLength={90} value={message} onChange={event => { setMessage(event.target.value); setPosted(false) }} placeholder="Say why their work mattered..." rows={2} />
      <div className="landing-pin-row"><span>{message.length}/90</span><button type="button" onClick={pin}>{posted ? 'Pinned ✓' : 'Pin a note →'}</button></div>
      {pinned && <p className="landing-pin-nudge">Pinned to the board. This wall is just a demo. <button type="button" onClick={onCreate}>Create your real wall below →</button></p>}
    </div>
  </div>
}

export default function HomePage() {
  const setupRef = useRef<HTMLDivElement>(null)
  const scrollToCreate = useCallback(() => {
    setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('create') === '1') requestAnimationFrame(scrollToCreate)
  }, [scrollToCreate])

  return <main className="landing-page">
    <header className="landing-header">
      <Link href="/" className="landing-logo"><Image src="/logo.svg" alt="TipWall logo" width={38} height={38} /><span>TipWall</span></Link>
      <nav><Link href="/explore"><span className="nav-full">Explore walls</span><span className="nav-short">Explore</span></Link><button onClick={scrollToCreate}><span className="nav-full">Create a wall</span><span className="nav-short">Create</span> <span>↗</span></button></nav>
    </header>
    <aside className="landing-supporter-line" aria-label="Support someone">Here to support someone? <Link href="/explore">Find their wall →</Link></aside>
    <RecentActivity />
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <p className="landing-eyebrow"><i className="landing-live-dot" /> SUPPORT THAT SAYS SOMETHING</p>
        <h1>Every supporter<br />leaves a <em>mark.</em></h1>
        <p className="landing-lede">Tip people, projects, and communities directly in NIM, and leave the reason it mattered. A public wall of support, insight, and small moments that last.</p>
        <div className="landing-actions"><button className="landing-btn landing-btn-dark" onClick={scrollToCreate}>Make your wall <span>↗</span></button><Link className="landing-btn landing-btn-light" href="/explore">Explore walls <span>→</span></Link></div>
        <div className="landing-trust"><span>No fees, ever</span><span>Wall owners keep 100%</span><span>Tips arrive in seconds</span></div>
        <p className="landing-nim-note">New here? <strong>NIM</strong> is Nimiq&apos;s digital cash. Send it straight to someone&apos;s wallet in seconds, no account needed. <a href="https://www.nimiq.com/get-nim/" target="_blank" rel="noopener noreferrer">Get NIM ↗</a></p>
      </div>
      <AppreciationBoard onCreate={scrollToCreate} />
    </section>
    <section className="landing-section landing-three"><div><p className="landing-section-kicker">A better kind of support</p><h2>Money is useful.<br /><em>Meaning is memorable.</em></h2></div><div className="landing-steps"><div><b>01</b><h3>Find someone worth backing</h3><p>Browse walls for people, projects, and communities you want to see grow.</p></div><div><b>02</b><h3>Tip with a reason</h3><p>Choose a signal like Helpful content, Open source, or Great idea.</p></div><div><b>03</b><h3>Make it part of their story</h3><p>Your NIM goes straight to their wallet. Your words stay on the wall.</p></div></div></section>
    <section className="landing-insight"><div><p className="landing-section-kicker">What wall owners learn</p><h2>Your supporters are telling you<br /><em>what to do next.</em></h2><p>Every reason becomes a signal. See whether people value your tutorials, your ideas, your art, or the fact that you keep showing up.</p><Link href="/explore" className="landing-text-link">See public walls →</Link></div><LiveSignalCard /></section>
    <section className="landing-create"><div><p className="landing-section-kicker">Ready when you are</p><h2>Put your name<br /><em>on the wall.</em></h2><p>Set up a TipWall in a few guided steps. Connect your Nimiq wallet, choose your link, and start collecting meaningful support.</p></div><div ref={setupRef}><CreateWallForm /></div></section>
    <EcosystemStats />
    <footer className="landing-footer"><Link href="/" className="landing-logo"><Image src="/logo.svg" alt="TipWall logo" width={30} height={30} /><span>TipWall</span></Link><MissionLink labelKey="learnAboutTipWall" variant="home" /><Link href="/faq" className="text-[#b9382a] underline underline-offset-4">FAQ</Link><PlatformSupportLink /><span>Built for people, projects, and communities on Nimiq · 0% platform fee</span></footer>
  </main>
}
