'use client'
import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({
  value,
  prefix = '',
}: {
  value: number
  prefix?: string
}) {
  const [display, setDisplay] = useState(value)
  // Where the last animation left off — the start point of the next one.
  // A ref (not `display` in deps) so the effect only re-runs on target change.
  const startRef = useRef(value)

  useEffect(() => {
    const start = startRef.current
    const diff = value - start
    const duration = 800
    const t0 = performance.now()

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(start + diff * eased)
      if (p < 1) requestAnimationFrame(tick)
      else startRef.current = value
    }

    if (diff !== 0) {
      requestAnimationFrame(tick)
    }
  }, [value])

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, { maximumFractionDigits: 0 })}
    </span>
  )
}
