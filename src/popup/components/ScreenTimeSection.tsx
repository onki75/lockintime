import { Clock, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { formatChange, formatMinutes } from '../../lib/format'
import { getUsageLevel } from '../../lib/screen-time'

type ScreenTimeSectionProps = {
  todayMinutes: number
  goalMinutes: number | null
  siteBreakdown: { domain: string; minutes: number }[]
  yesterdayMinutes: number | null
}

const usageLevelClasses = {
  low: 'bg-emerald-500',
  moderate: 'bg-amber-400',
  high: 'bg-orange-500',
  exceeded: 'bg-red-500',
} as const

export function ScreenTimeSection({
  todayMinutes,
  goalMinutes,
  siteBreakdown,
  yesterdayMinutes,
}: ScreenTimeSectionProps) {
  const topSites = siteBreakdown.filter((site) => site.minutes > 0).slice(0, 3)
  const topMinutes = topSites[0]?.minutes ?? 0
  const comparison = yesterdayMinutes === null ? null : formatChange(todayMinutes - yesterdayMinutes)
  const progressPercent = goalMinutes && goalMinutes > 0
    ? Math.min(100, (todayMinutes / goalMinutes) * 100)
    : 0
  const progressClassName = goalMinutes === null
    ? 'bg-blue-500'
    : usageLevelClasses[getUsageLevel(todayMinutes, goalMinutes)]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">今日のスクリーンタイム</p>
          <p className="mt-1 text-xs text-gray-500">ブロック対象サイトの合計利用時間</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
          <Clock className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {goalMinutes !== null ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Target className="h-3.5 w-3.5 text-gray-400" />
                <span>目標まで</span>
              </div>
              <span className="font-semibold text-gray-900">
                {formatMinutes(todayMinutes)} / {formatMinutes(goalMinutes)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${progressClassName}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-3 py-2.5">
            <span className="text-xs font-medium text-blue-700">今日の合計</span>
            <span className={`text-sm font-semibold text-white ${progressClassName} rounded-full px-2.5 py-1`}>
              {formatMinutes(todayMinutes)}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {topSites.length > 0 ? (
            topSites.map((site) => (
              <div key={site.domain} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-gray-700">{site.domain}</span>
                    <span className="shrink-0 text-gray-500">{formatMinutes(site.minutes)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-50">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                      style={{ width: `${topMinutes > 0 ? (site.minutes / topMinutes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
              まだ今日の利用記録はありません。
            </div>
          )}
        </div>

        {comparison ? (
          <div
            className={[
              'flex items-center gap-1.5 text-xs font-medium',
              comparison.positive ? 'text-emerald-600' : 'text-red-500',
            ].join(' ')}
          >
            {comparison.text === '昨日と同じ' ? (
              <Clock className="h-3.5 w-3.5" />
            ) : comparison.positive ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            <span>{comparison.text}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
