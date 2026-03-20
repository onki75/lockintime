import { Clock, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBackgroundState, saveSettings } from '../../lib/storage'
import { formatMinutes } from '../../lib/format'
import { getGoalAchievementCount } from '../../lib/screen-time'
import type { BackgroundState, DailyStats, ScreenTimeGoal, Settings } from '../../lib/types'

type ScreenTimeSettingsProps = {
  settings: Settings
}

type SaveState = 'idle' | 'saving' | 'error'
type WeekPeriod = 'current' | 'previous'

type WeeklyBreakdown = {
  domain: string
  minutes: number
}

type ChartDay = {
  date: string
  label: string
  minutes: number
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shiftLocalDate(date: string, days: number): string {
  const nextDate = parseLocalDate(date)
  nextDate.setDate(nextDate.getDate() + days)
  return formatLocalDate(nextDate)
}

function getWeekStart(date: string): string {
  const current = parseLocalDate(date)
  const day = current.getDay()
  const offset = day === 0 ? -6 : 1 - day
  current.setDate(current.getDate() + offset)
  return formatLocalDate(current)
}

function getDayTotal(dailyStats: DailyStats | null | undefined): number {
  if (!dailyStats) {
    return 0
  }

  return Object.values(dailyStats.durations).reduce((total, minutes) => total + minutes, 0)
}

function normalizeGoalMinutes(minutes: number): number {
  const clamped = Math.min(240, Math.max(5, minutes))
  return Math.round(clamped / 5) * 5
}

function getHistory(backgroundState: BackgroundState | null): Record<string, DailyStats> {
  if (!backgroundState) {
    return {}
  }

  const history = { ...backgroundState.dailyStatsHistory }

  if (backgroundState.dailyStats) {
    history[backgroundState.dailyStats.date] = backgroundState.dailyStats
  }

  return history
}

function buildChartDays(
  history: Record<string, DailyStats>,
  startDate: string,
): ChartDay[] {
  return DAY_LABELS.map((label, index) => {
    const date = shiftLocalDate(startDate, index)

    return {
      date,
      label,
      minutes: getDayTotal(history[date]),
    }
  })
}

function buildWeeklyBreakdown(
  history: Record<string, DailyStats>,
  startDate: string,
): WeeklyBreakdown[] {
  const totals = new Map<string, number>()

  for (let index = 0; index < 7; index += 1) {
    const date = shiftLocalDate(startDate, index)
    const durations = history[date]?.durations ?? {}

    for (const [domain, minutes] of Object.entries(durations)) {
      totals.set(domain, (totals.get(domain) ?? 0) + minutes)
    }
  }

  return [...totals.entries()]
    .map(([domain, minutes]) => ({ domain, minutes }))
    .filter((site) => site.minutes > 0)
    .sort((left, right) => {
      if (right.minutes !== left.minutes) {
        return right.minutes - left.minutes
      }

      return left.domain.localeCompare(right.domain)
    })
}

function formatWeekChange(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) {
    return '比較データなし'
  }

  const rounded = Math.round(percent)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function ScreenTimeSettings({ settings }: ScreenTimeSettingsProps) {
  const [goal, setGoal] = useState<ScreenTimeGoal>(settings.screenTimeGoal)
  const [goalInput, setGoalInput] = useState(`${settings.screenTimeGoal.dailyLimitMinutes}`)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [backgroundState, setBackgroundState] = useState<BackgroundState | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<WeekPeriod>('current')

  useEffect(() => {
    setGoal(settings.screenTimeGoal)
    setGoalInput(`${settings.screenTimeGoal.dailyLimitMinutes}`)
  }, [settings])

  useEffect(() => {
    let active = true

    async function loadBackground() {
      try {
        const nextBackgroundState = await getBackgroundState()

        if (active) {
          setBackgroundState(nextBackgroundState)
        }
      } catch {
        if (active) {
          setBackgroundState(null)
        }
      }
    }

    void loadBackground()

    const onChange = () => void loadBackground()
    chrome.storage.onChanged.addListener(onChange)

    return () => {
      active = false
      chrome.storage.onChanged.removeListener(onChange)
    }
  }, [])

  async function persistGoal(nextGoal: ScreenTimeGoal) {
    setGoal(nextGoal)
    setGoalInput(`${nextGoal.dailyLimitMinutes}`)
    setSaveState('saving')

    try {
      await saveSettings({
        ...settings,
        screenTimeGoal: nextGoal,
        updatedAt: Date.now(),
      })
      setSaveState('idle')
    } catch (error) {
      console.error(error)
      setSaveState('error')
    }
  }

  function handleGoalEnabledChange(enabled: boolean) {
    void persistGoal({
      ...goal,
      enabled,
    })
  }

  function handleGoalMinutesChange(value: string) {
    setGoalInput(value)

    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return
    }

    void persistGoal({
      ...goal,
      dailyLimitMinutes: normalizeGoalMinutes(parsed),
    })
  }

  const history = getHistory(backgroundState)
  const today = backgroundState?.dailyStats?.date ?? new Date().toLocaleDateString('sv-SE')
  const currentWeekStart = getWeekStart(today)
  const selectedWeekStart = selectedPeriod === 'current'
    ? currentWeekStart
    : shiftLocalDate(currentWeekStart, -7)
  const previousWeekStart = shiftLocalDate(selectedWeekStart, -7)
  const chartDays = buildChartDays(history, selectedWeekStart)
  const currentWeekTotal = chartDays.reduce((total, day) => total + day.minutes, 0)
  const previousWeekTotal = buildChartDays(history, previousWeekStart)
    .reduce((total, day) => total + day.minutes, 0)
  const weeklyBreakdown = buildWeeklyBreakdown(history, selectedWeekStart)
  const topWeeklySite = weeklyBreakdown[0] ?? null
  const comparisonPercent = previousWeekTotal > 0
    ? ((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100
    : null
  const maxDailyMinutes = Math.max(...chartDays.map((day) => day.minutes), 0)
  const chartScaleMax = maxDailyMinutes > 0 ? Math.ceil(maxDailyMinutes / 10) * 10 : 60
  const goalAchievement = goal.enabled
    ? getGoalAchievementCount(
      history,
      goal.dailyLimitMinutes,
      selectedWeekStart,
      shiftLocalDate(selectedWeekStart, 6),
    )
    : null

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">スクリーンタイム目標</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              ブロックリスト内サイトの合計使用時間に対して、1日の上限を設定します。
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              checked={goal.enabled}
              onChange={(event) => handleGoalEnabledChange(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">1日の目標を設定する</span>
          </label>

          <div className="rounded-2xl border border-gray-200 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">目標時間</p>
                <p className="mt-1 text-xs text-gray-500">5分刻み、5〜240分で設定できます。</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={goalInput}
                  disabled={!goal.enabled}
                  onChange={(event) => handleGoalMinutesChange(event.target.value)}
                  onBlur={() => setGoalInput(`${goal.dailyLimitMinutes}`)}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-right text-lg font-semibold text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="text-sm font-medium text-gray-600">分</span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              ※ ブロックリスト内サイトの合計使用時間に対する目標です
            </p>
          </div>

          {saveState === 'error' ? (
            <p className="text-sm text-red-600">目標の保存に失敗しました。もう一度お試しください。</p>
          ) : saveState === 'saving' ? (
            <p className="text-sm text-gray-500">保存中...</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">週間レポート</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                1週間ごとの推移と、よく使ったサイトの傾向を確認できます。
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setSelectedPeriod('current')}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                selectedPeriod === 'current'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900',
              ].join(' ')}
            >
              今週
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('previous')}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                selectedPeriod === 'previous'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900',
              ].join(' ')}
            >
              先週
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-cyan-50 px-4 py-5">
          <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-blue-500 uppercase">
            分
          </div>
          <div className="flex gap-3">
            <div className="flex h-40 flex-col justify-between pb-6 text-[11px] text-gray-400">
              <span>{chartScaleMax}</span>
              <span>{Math.round(chartScaleMax / 2)}</span>
              <span>0</span>
            </div>

            <div className="relative flex flex-1 items-end gap-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-blue-100" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blue-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-6 h-px bg-blue-200" />

              {chartDays.map((day) => (
                <div key={day.date} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-40 w-full items-end justify-center">
                    <div className="pointer-events-none absolute bottom-[calc(100%-0.5rem)] left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {formatMinutes(day.minutes)}
                    </div>
                    <div
                      className="w-full max-w-9 rounded-t-2xl bg-blue-500 shadow-[0_12px_24px_rgba(59,130,246,0.22)] transition-transform duration-200 group-hover:-translate-y-1"
                      style={{
                        height: `${chartScaleMax > 0 ? Math.max((day.minutes / chartScaleMax) * 100, day.minutes > 0 ? 8 : 0) : 0}%`,
                      }}
                      title={formatMinutes(day.minutes)}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase">
              {selectedPeriod === 'current' ? '今週合計' : '先週合計'}
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatMinutes(currentWeekTotal)}</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase">
              {selectedPeriod === 'current' ? '先週比' : '前週比'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {comparisonPercent !== null && comparisonPercent <= 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              ) : comparisonPercent !== null ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : null}
              <p className={comparisonPercent !== null && comparisonPercent <= 0 ? 'text-xl font-bold text-emerald-600' : comparisonPercent !== null ? 'text-xl font-bold text-red-500' : 'text-xl font-bold text-gray-400'}>
                {formatWeekChange(comparisonPercent)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase">最も多い</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {topWeeklySite ? `${topWeeklySite.domain} (${formatMinutes(topWeeklySite.minutes)})` : '記録なし'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase">目標達成</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {goalAchievement ? `${goalAchievement.achieved}/${goalAchievement.total}日` : '目標未設定'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <p className="text-xs font-semibold tracking-[0.16em] text-gray-400 uppercase">サイト別</p>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="mt-4 space-y-3">
            {weeklyBreakdown.length > 0 ? (
              weeklyBreakdown.slice(0, 3).map((site) => (
                <div key={site.domain} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-gray-700">{site.domain}</span>
                      <span className="shrink-0 text-gray-500">{formatMinutes(site.minutes)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-50">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                        style={{
                          width: `${topWeeklySite ? (site.minutes / topWeeklySite.minutes) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                この期間のスクリーンタイム記録はまだありません。
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
