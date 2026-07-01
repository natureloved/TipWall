'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardData } from '@/lib/types'
import DashboardStats from '@/components/DashboardStats'
import DashboardSupporters from '@/components/DashboardSupporters'
import DashboardEditProfile from '@/components/DashboardEditProfile'
import DashboardMilestones from '@/components/DashboardMilestones'
import { getNimiq, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'

export default function DashboardPage() {
  const { handle } = useParams<{ handle: string }>()
  const router = useRouter()
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
    <div className="p-6 text-center text-gray-400 text-sm">Loading your dashboard...</div>
  )
  if (error) return (
    <div className="p-6 text-center text-red-500 text-sm">{error}</div>
  )
  if (!data) return null

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#1F2348] p-4 flex items-center justify-between">
        <div>
          <p className="text-[#F6B221] font-medium">Your Dashboard</p>
          <p className="text-[#AFA9EC] text-xs">@{data.profile.handle}</p>
        </div>
        <a href={`/${handle}`} className="text-xs text-[#AFA9EC] underline">View public wall</a>
      </div>

      <div className="p-4 space-y-5">
        <DashboardStats data={data} />
        <DashboardMilestones data={data} />
        <DashboardSupporters supporters={data.supporters} />
        <DashboardEditProfile profile={data.profile} walletAddress={walletAddress} />
      </div>
    </div>
  )
}