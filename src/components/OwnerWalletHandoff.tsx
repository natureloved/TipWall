'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Link from 'next/link'
import Image from 'next/image'
import { buildNimiqPayDeepLink, isMobileDevice, wallUrl } from '@/lib/environment'
import { useTranslations } from '@/lib/i18n'

export default function OwnerWalletHandoff({ handle, surface = 'dashboard' }: { handle: string; surface?: 'dashboard' | 'edit' }) {
  const t = useTranslations()
  const [qr, setQr] = useState('')
  const target = `${wallUrl(handle)}/${surface}`
  const deepLink = buildNimiqPayDeepLink(target)

  useEffect(() => {
    if (isMobileDevice()) return
    QRCode.toDataURL(deepLink, { width: 220, margin: 1, color: { dark: '#171614', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [deepLink])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e6] px-4 py-12 text-[#171614]">
      <section className="w-full max-w-md rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-6 text-center shadow-[5px_5px_0_#171614]">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('ownerAccess')}</p>
        <h1 className="text-2xl font-bold">{t('ownerOpenNimiq')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5f574b]">{t('ownerWalletRequired')}</p>
        {isMobileDevice() ? <a href={deepLink} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#171614] px-4 py-3 font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c]">{t('ownerOpenNimiq')} <span className="ml-2">↗</span></a> : <div className="mt-5 flex flex-col items-center gap-3">{qr ? <Image src={qr} alt={t('ownerScanNimiq')} width={220} height={220} unoptimized className="rounded-xl border border-[#cfc2af] bg-white p-2" /> : <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-[#e9e2d2]" />}<p className="text-xs text-[#5f574b]">{t('ownerScanNimiq')}</p></div>}
        <Link href={`/${handle}`} className="mt-5 inline-block text-xs font-semibold text-[#b9382a] underline underline-offset-4">{t('ownerBackToWall')}</Link>
      </section>
    </main>
  )
}
