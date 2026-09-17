'use client'

import { useEffect, useState } from 'react'

/**
 * Floating back-to-top arrow button that appears when the user scrolls down
 * into the lower sections of the homepage (e.g. create wall form & footer).
 * Matches TipWall's retro-paper design language with smooth scrolling.
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Reveal button when user has scrolled down into the lower sections
      const scrolled = window.scrollY
      const docHeight = document.documentElement.scrollHeight
      const winHeight = window.innerHeight

      // Show if scrolled past 600px or within the bottom 60% of the page
      const isNearBottom = scrolled > 600 || (scrolled + winHeight > docHeight * 0.5)
      setVisible(isNearBottom)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-[var(--ink,#171614)] bg-[var(--ink,#171614)] text-[var(--cream,#fffdf7)] shadow-[3px_3px_0_var(--coral,#c73f2b)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[5px_5px_0_var(--coral,#c73f2b)] active:translate-y-0 active:shadow-[2px_2px_0_var(--coral,#c73f2b)] ${
        visible
          ? 'pointer-events-auto opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-4'
      }`}
    >
      <svg
        className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
