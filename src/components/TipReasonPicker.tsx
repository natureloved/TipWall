'use client'
import { TipReason, TIP_REASON_LABELS } from '@/lib/types'
import { useTranslations } from '@/lib/i18n'

interface Props {
  selected: TipReason | null
  onChange: (reason: TipReason) => void
}

export default function TipReasonPicker({ selected, onChange }: Props) {
  const t = useTranslations()
  return (
    <div className="mb-4">
      <p className="tip-reason-label text-xs mb-2 font-medium">
        {t('whyTipping')} <span>{t('optional')}</span>
      </p>
      <div className="tip-reason-grid grid grid-cols-2 gap-2">
        {(Object.keys(TIP_REASON_LABELS) as TipReason[]).map((reason) => {
          const { emoji } = TIP_REASON_LABELS[reason]
          const isSelected = selected === reason
          return (
            <button
              key={reason}
              type="button"
              onClick={() => onChange(reason)}
              className={`tip-reason-button flex items-center gap-2 px-3 py-2 rounded-full border text-xs transition-all text-left ${
                isSelected
                  ? 'tip-reason-selected border-amber-400 font-medium'
                  : 'tip-reason-option'
              }`}
            >
              <span className="text-sm shrink-0">{emoji}</span>
              <span className="truncate">{t(`reason_${reason}`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
