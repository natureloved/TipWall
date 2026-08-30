'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardData } from '@/lib/types'
import DashboardStats from '@/components/DashboardStats'
import DashboardSupporters from '@/components/DashboardSupporters'
import DashboardTips from '@/components/DashboardTips'
import DashboardPledges from '@/components/DashboardPledges'
import DashboardExport from '@/components/DashboardExport'
import DashboardEditProfile from '@/components/DashboardEditProfile'
import DashboardMilestones from '@/components/DashboardMilestones'
import DashboardShareNudge from '@/components/DashboardShareNudge'
import { getNimiq, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import { useTranslations } from '@/lib/i18n'

export default function DashboardPage() {
  const { handle } = useParams<{ handle: string }>()
  const router = useRouter()
  const t = useTranslations()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walletAddress, setWalletAddress] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const nimiq = await getNimiq()
        const accounts = await nimiq.listAccounts()
        // accounts is either string[] or { error: ... } - extract address safely
        const rawAddress = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null
        if (!rawAddress) throw new Error('No Nimiq wallet connected')
        const address = normalizeAddress(rawAddress)
        setWalletAddress(address)

        // Prove ownership with a signed `view` authorization (the wallet address
        // by itself is public, so the server won't trust an unsigned header).
        const proof = await signProfileAuth({ action: 'view', handle, walletAddress: address })
        const authHeader = btoa(JSON.stringify(proof))

        const res = await fetch(`/api/dashboard/${handle}`, {
          headers: { 'x-tipwall-auth': authHeader },
        })

        if (res.status === 401 || res.status === 403) {
          router.replace(`/${handle}`)
          return
        }
        if (!res.ok) throw new Error('Failed to load dashboard')

        const json = await res.json()
        setData(json)
      } catch (e) {
        const error = e as Error
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [handle, router])

  if (loading) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e6] px-4 py-12">
      <p className="rounded-lg border border-[#171614]/25 bg-[#fffaf0] px-5 py-4 text-center text-sm font-medium text-[#5f574b] shadow-[3px_3px_0_rgba(23,22,20,0.12)]" role="status">
        {t('dashLoading')}
      </p>
    </main>
  )
  if (error) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e6] px-4 py-12">
      <p className="max-w-md rounded-lg border border-[#9d2c21]/35 bg-[#fffaf0] px-5 py-4 text-center text-sm font-medium text-[#9d2c21] shadow-[3px_3px_0_rgba(23,22,20,0.12)]" role="alert">
        {error}
      </p>
    </main>
  )
  if (!data) return null

  return (
    <main className="min-h-screen bg-[#f4f0e6] text-[#171614]">
      <header className="border-b border-[#171614]/25 bg-[#fffaf0] px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-xl font-semibold text-[#171614]">{t('dashTitle')}</p>
            <p className="mt-0.5 text-xs font-medium text-[#746b5e]">@{data.profile.handle}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Dashboard links">
            <a
              href={`/${handle}/share`}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#171614] bg-[#f05a3c] px-4 py-2 text-xs font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[#e85236] hover:shadow-[4px_4px_0_#171614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9382a]"
            >
              {t('dashShareKit')}
            </a>
            <a
              href={`/${handle}`}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#171614]/35 bg-[#f4f0e6] px-4 py-2 text-xs font-bold text-[#171614] transition-colors hover:border-[#b9382a] hover:bg-[#fffdf7] hover:text-[#b9382a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9382a]"
            >
              {t('dashViewWall')}
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-6">
        <DashboardShareNudge data={data} />
        <DashboardStats data={data} />
        <DashboardMilestones data={data} />
        <DashboardSupporters supporters={data.supporters} />
        <DashboardTips handle={String(handle)} tips={data.tips} walletAddress={walletAddress} />
        <DashboardPledges pledges={data.pledges || []} />
        <DashboardExport handle={String(handle)} tips={data.tips} />
        <DashboardEditProfile profile={data.profile} walletAddress={walletAddress} />
      </div>
    </main>
  )
}
