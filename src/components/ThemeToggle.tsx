'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  // null = not mounted yet (server render / pre-hydration): render nothing so
  // the button can't flash the wrong icon before the theme is known.
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null)

  useEffect(() => {
    // The pre-paint script in layout.tsx has already applied the correct theme to
    // <html data-theme>; read it back so our button matches (no second guess).
    // Deferred to a frame so the state update never lands mid-commit.
    const raf = requestAnimationFrame(() => {
      const current =
        (document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null) ||
        (localStorage.getItem('theme') as 'dark' | 'light' | null) ||
        'dark'
      setTheme(current)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  if (!theme) return null

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={`group fixed top-4 right-4 z-40 grid h-9 w-9 place-items-center overflow-hidden rounded-full border shadow-lg backdrop-blur-md transition-all duration-500 hover:scale-110 active:scale-95 ${
        isDark
          ? 'border-amber-300/30 bg-slate-800/70 text-amber-300 hover:border-amber-300/60'
          : 'border-slate-300 bg-white/85 text-slate-700 hover:border-amber-400/70 hover:text-amber-500'
      }`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Soft glow behind the sun in dark mode */}
      <span
        className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(circle at center, rgba(251,191,36,0.28), transparent 70%)' }}
      />
      <svg
        viewBox="0 0 24 24"
        className={`relative h-5 w-5 transition-transform duration-500 ${isDark ? 'group-hover:rotate-90' : 'group-hover:-rotate-12'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDark ? (
          // Sun — click to switch to light
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
            <line x1="12" y1="1.5" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22.5" y2="12" />
            <line x1="4.6" y1="4.6" x2="6.3" y2="6.3" />
            <line x1="17.7" y1="17.7" x2="19.4" y2="19.4" />
            <line x1="4.6" y1="19.4" x2="6.3" y2="17.7" />
            <line x1="17.7" y1="6.3" x2="19.4" y2="4.6" />
          </>
        ) : (
          // Crescent moon with a couple of sparkles — click to switch to dark
          <>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" stroke="none" />
            <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" className="opacity-80" />
            <circle cx="20" cy="10" r="0.6" fill="currentColor" stroke="none" className="opacity-60" />
          </>
        )}
      </svg>
    </button>
  )
}
