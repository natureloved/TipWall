'use client'

import { useTranslations } from '@/lib/i18n'
import { platformSupportUrl } from '@/lib/environment'

/**
 * Optional maintenance funding link. Deployments opt in with
 * NEXT_PUBLIC_SUPPORT_URL; creator tips never route through this destination.
 */
export default function PlatformSupportLink({ className = '', showSeparator = false }: { className?: string; showSeparator?: boolean }) {
  const href = platformSupportUrl()
  const t = useTranslations()
  if (!href) return null

  return (
    <>
      {showSeparator && ' · '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className || 'font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614]'}
      >
        {t('supportTipWall')}
      </a>
    </>
  )
}
