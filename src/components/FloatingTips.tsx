'use client'
import { useEffect, useState } from 'react'

const EMOJIS = ['💸', '🪙', '✨', '🔥', '💖', '🎉']

export default function FloatingTips({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: number; duration: number }[]>([])

  useEffect(() => {
    if (trigger === 0) return
    const newOnes = Array.from({ length: 18 }, (_, i) => ({
      id: Date.now() + i,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      left: Math.random() * 100,
      duration: 2 + Math.random() * 2,
    }))
    setParticles((p) => [...p, ...newOnes])
    setTimeout(() => {
      setParticles((p) => p.filter((x) => !newOnes.includes(x)))
    }, 4500)
  }, [trigger])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute bottom-0 text-4xl"
          style={{
            left: `${p.left}%`,
            animation: `floatUp ${p.duration}s linear forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(-110vh) scale(1.4) rotate(20deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
