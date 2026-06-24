'use client'
import { useEffect, useState } from 'react'

export default function AnimatedNumber({
  value,
  prefix = '',
}: {
  value: number
  prefix?: string
}) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const start = display
    const diff = value - start
    const duration = 800
    const t0 = performance.now()

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(start + diff * eased)
      if (p < 1) requestAnimationFrame(tick)
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
