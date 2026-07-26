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
      <p className="text-xs text-white/60 mb-2 font-medium">
        {t('whyTipping')} <span className="text-white/40">{t('optional')}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TIP_REASON_LABELS) as TipReason[]).map((reason) => {
          const { emoji } = TIP_REASON_LABELS[reason]
          const isSelected = selected === reason
          return (
            <button
              key={reason}
              type="button"
              onClick={() => onChange(reason)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs transition-all text-left ${
                isSelected
                  ? 'border-amber-400 bg-amber-400/15 text-white font-medium'
                  : 'border-white/15 text-white/70 hover:border-white/30 hover:bg-white/5'
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
