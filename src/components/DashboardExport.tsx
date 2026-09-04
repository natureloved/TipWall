'use client'
import { useState } from 'react'
import { type CreatorProfile, type MilestoneEvent, type Supporter, type Tip } from '@/lib/types'
import { useTranslations } from '@/lib/i18n'
import { normalizeAddress } from '@/lib/profile-auth'
import { signWallSnapshot } from '@/lib/nimiq'
import { buildSignedWallSnapshot, buildWallSnapshotMessage, buildWallSnapshotPayload } from '@/lib/wall-snapshot'

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function DashboardExport({ handle, tips, profile, supporters, milestones, walletAddress, totalNIM, totalTips }: { handle: string; tips: Tip[]; profile?: CreatorProfile; supporters?: Supporter[]; milestones?: MilestoneEvent[]; walletAddress: string; totalNIM: number; totalTips: number }) {
  const t = useTranslations()
  const [signing, setSigning] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exported, setExported] = useState(false)
  const download = () => {
    const rows = [
      ['date', 'asset', 'amount_nim', 'amount_usdt', 'reason', 'message', 'verified', 'sender'],
      ...tips.map(t => [
        new Date(t.timestamp).toISOString(),
        t.asset || 'NIM',
        t.amountNIM,
        t.amountUSDT || '',
        t.reason || '',
        t.message || '',
        t.verified,
        t.anonymous ? 'anonymous' : t.senderAddress,
      ]),
    ]
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tipwall-${handle}-tips.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadBackup = async () => {
    if (!profile || !walletAddress || normalizeAddress(walletAddress) !== normalizeAddress(profile.walletAddress)) {
      setExportError(t('exportError'))
      return
    }
    setSigning(true)
    setExportError('')
    setExported(false)
    try {
      const payload = buildWallSnapshotPayload({
        profile,
        tips,
        supporters,
        milestones,
        totalNIM,
        totalTips,
      })
      const signed = await signWallSnapshot(buildWallSnapshotMessage(payload))
      const snapshot = buildSignedWallSnapshot(payload, signed)
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `tipwall-${handle}-snapshot.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setExported(true)
    } catch (error) {
      setExportError(error instanceof Error ? `${t('exportError')}: ${error.message}` : t('exportError'))
    } finally {
      setSigning(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#171614]">{t('exportTitle')}</h2>
          <p className="mt-1 text-xs text-[#746b5e]">{t('exportSnapshotBody')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={download}
            disabled={!tips.length}
            className="rounded-lg border border-[#171614] bg-[#f05a3c] px-4 py-2 text-xs font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {t('exportCsv')}
          </button>
          <button
            onClick={downloadBackup}
            disabled={!profile || !walletAddress || signing}
            className="rounded-lg border border-[#171614] bg-[#fffdf7] px-4 py-2 text-xs font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {signing ? t('exportSigning') : t('exportSnapshot')}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#746b5e]" role="status" aria-live="polite">
        {exportError || (exported ? t('exportSigned') : '')}
      </p>
    </section>
  )
}
