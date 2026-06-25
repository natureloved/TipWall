'use client'
import { useEffect } from 'react'
import { getNimiq } from '@/lib/nimiq'

export function NimiqProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize as early as possible, on mount
    getNimiq().catch(() => {})
  }, [])
  return <>{children}</>
}