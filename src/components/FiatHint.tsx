'use client'
import { useEffect, useState } from 'react'

type Rates = { usd?: number; eur?: number }

let sharedRates: Rates | null = null

const EU_REGIONS = new Set(['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'LU', 'CY', 'MT', 'HR'])

/**
 * Approximate fiat value for a NIM amount ("≈ $4"). Reference prices only -
 * never used for payments. Renders nothing while rates are unknown so a
 * CoinGecko outage is invisible to supporters.
 */
export default function FiatHint({ nim, className }: { nim: number; className?: string }) {
  const [rates, setRates] = useState<Rates | null>(sharedRates)

  useEffect(() => {
    if (sharedRates) return
    fetch('/api/price')
      .then(res => (res.ok ? (res.json() as Promise<Rates>) : null))
      .then(data => {
        if (data && (data.usd || data.eur)) {
          sharedRates = data
          setRates(data)
        }
      })
      .catch(() => {})
  }, [])

  if (!rates || !nim || (!rates.usd && !rates.eur)) return null
  const region = (typeof navigator !== 'undefined' ? navigator.language.split('-')[1] : '')?.toUpperCase() || 'US'
  const useEur = EU_REGIONS.has(region)
  const rate = useEur ? rates.eur : rates.usd
  if (!rate) return null
  const fiat = nim * rate
  const label = fiat < 1 ? fiat.toFixed(2) : Math.round(fiat).toLocaleString()
  return (
    <span className={className} title="Approximate fiat value">
      ≈ {useEur ? '€' : '$'}{label}
    </span>
  )
}
