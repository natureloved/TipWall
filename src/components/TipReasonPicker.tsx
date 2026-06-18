'use client'
import { TipReason, TIP_REASON_LABELS } from '@/lib/types'

interface Props {
  selected: TipReason | null
  onChange: (reason: TipReason) => void
}

export default function TipReasonPicker({ selected, onChange }: Props) {
  return (
    <div className="mb-4">
      <p className="text-xs text-white/70 mb-2 font-medium">Why are you tipping?</p>
      <div className="flex flex-col gap-2">
        {(Object.keys(TIP_REASON_LABELS) as TipReason[]).map((reason) => {
          const { emoji, label } = TIP_REASON_LABELS[reason]
          const isSelected = selected === reason
          return (
            <button
              key={reason}
              onClick={() => onChange(reason)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all text-left ${
                isSelected
                  ? 'border-amber-400 bg-slate-700 text-white font-medium'
                  : 'border-slate-600 text-white/80 hover:border-slate-500 hover:bg-slate-800/50'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span>{label}</span>
              {isSelected && <span className="ml-auto text-amber-400">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
 
