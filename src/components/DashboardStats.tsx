import { DashboardData, TIP_REASON_LABELS } from '@/lib/types'

export default function DashboardStats({ data }: { data: DashboardData }) {
  const todayNIM = data.tipsLast7Days.reduce((s, d) => s + d.nim, 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-[#1F2348]">{data.totalNIM.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total NIM earned</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-[#1F2348]">{data.totalTips}</p>
          <p className="text-xs text-gray-500 mt-1">Total tips</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-[#1F2348]">{data.supporters?.length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Unique supporters</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-medium text-[#1F2348]">{todayNIM.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">NIM, last 7 days</p>
        </div>
      </div>

      {data.topReason && (
        <div className="bg-[#FAEEDA] rounded-xl p-3 text-sm text-[#633806]">
          Most common reason: <strong>{TIP_REASON_LABELS[data.topReason].emoji} {TIP_REASON_LABELS[data.topReason].label}</strong>
        </div>
      )}

      {data.nextMilestone && (
        <p className="text-xs text-gray-400 mt-3">
          {(data.nextMilestone - data.totalNIM).toLocaleString()} NIM to your next milestone ({data.nextMilestone.toLocaleString()} NIM)
        </p>
      )}
    </div>
  )
}