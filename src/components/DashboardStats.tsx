import { DashboardData, TIP_REASON_LABELS } from '@/lib/types'
import { useTranslations } from '@/lib/i18n'

export default function DashboardStats({ data }: { data: DashboardData }) {
  const t = useTranslations()
  const lastSevenDaysNIM = data.tipsLast7Days.reduce((sum, day) => sum + day.nim, 0)
  const stats = [
    { value: data.totalNIM.toLocaleString(), label: t('statsTotalNim') },
    { value: data.totalTips.toLocaleString(), label: t('statsTotalTips') },
    { value: (data.supporters?.length ?? 0).toLocaleString(), label: t('statsSupporters') },
    { value: lastSevenDaysNIM.toLocaleString(), label: t('statsLast7') },
  ]

  return (
    <section aria-labelledby="dashboard-overview-heading">
      <h2 id="dashboard-overview-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        {t('statsOverview')}
      </h2>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-lg border border-[#171614]/20 bg-[#fffaf0] p-3 shadow-[2px_2px_0_rgba(23,22,20,0.1)] sm:p-4">
            <p className="break-words font-serif text-xl font-semibold leading-tight text-[#171614] sm:text-2xl">{stat.value}</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#5f574b]">{stat.label}</p>
          </div>
        ))}
      </div>

      {data.topReason && (
        <div className="rounded-lg border border-[#b9382a]/30 bg-[#fbd8cf] p-3 text-sm leading-relaxed text-[#5c1f17]">
          {t('statsTopReason')} <strong className="font-bold">{TIP_REASON_LABELS[data.topReason].emoji} {t(`reason_${data.topReason}`)}</strong>
        </div>
      )}

      {data.nextMilestone && (
        <p className="mt-3 text-xs font-medium leading-relaxed text-[#5f574b]">
          {t('statsNextMilestone', { n: (data.nextMilestone - data.totalNIM).toLocaleString(), m: data.nextMilestone.toLocaleString() })}
        </p>
      )}
    </section>
  )
}
