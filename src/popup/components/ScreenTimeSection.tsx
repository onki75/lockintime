import { Info, Timer } from 'lucide-react'
import { formatMinutes } from '../../lib/format'

type ScreenTimeSectionProps = {
  todayMinutes: number
  goalMinutes: number | null
  siteBreakdown: { domain: string; minutes: number }[]
  yesterdayMinutes: number | null
}

const DEFAULT_GOAL_MINUTES = 120

export function ScreenTimeSection({
  todayMinutes,
  goalMinutes,
  siteBreakdown,
}: ScreenTimeSectionProps) {
  const goalEnabled = goalMinutes !== null
  const goal = goalMinutes ?? DEFAULT_GOAL_MINUTES
  const remaining = goalEnabled ? Math.max(0, goal - todayMinutes) : null
  const exceeded = goalEnabled && todayMinutes >= goal
  const percent = goalEnabled ? Math.min(100, (todayMinutes / goal) * 100) : 0
  const topSites = siteBreakdown.filter((s) => s.minutes > 0).slice(0, 3)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className={`h-4 w-4 ${exceeded ? 'text-red-500' : 'text-blue-600'}`} />
          <p className="text-sm font-semibold text-gray-900">
            {goalEnabled ? '今日の残り' : '今日の利用時間'}
          </p>
          <div className="group relative">
            <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {goalEnabled ? `1日の目標: ${formatMinutes(goal)}まで` : 'スクリーンタイム目標は未設定です'}
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {goalEnabled ? `${formatMinutes(todayMinutes)} / ${formatMinutes(goal)}` : formatMinutes(todayMinutes)}
        </span>
      </div>

      {/* Progress bar */}
      {goalEnabled ? (
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              exceeded ? 'bg-red-500' : percent > 75 ? 'bg-amber-400' : 'bg-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {/* Remaining or exceeded message */}
      <div className="mt-2">
        {!goalEnabled ? (
          <p className="text-center text-sm font-bold text-blue-600">
            目標は未設定です。今日は {formatMinutes(todayMinutes)} 記録されています
          </p>
        ) : exceeded ? (
          <p className="text-center text-sm font-bold text-red-600">
            目標を{formatMinutes(todayMinutes - goal)}超過しています
          </p>
        ) : (
          <p className={`text-center text-sm font-bold ${remaining !== null && remaining <= 30 ? 'text-amber-600' : 'text-blue-600'}`}>
            あと {formatMinutes(remaining ?? 0)}
          </p>
        )}
      </div>

      {/* Site breakdown */}
      {topSites.length > 0 ? (
        <div className="mt-2.5 space-y-1.5 border-t border-gray-100 pt-2.5">
          {topSites.map((site) => (
            <div key={site.domain} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-gray-500">{site.domain}</span>
              <span className="shrink-0 text-xs font-medium text-gray-700">{formatMinutes(site.minutes)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
