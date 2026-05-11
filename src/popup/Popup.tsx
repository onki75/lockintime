import { Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { startTemporaryBypass } from '../lib/bypass'
import { getEffectiveLicensePlan } from '../lib/license'
import { getActiveRules, resolveRulePlanState } from '../lib/rule-activation'
import { getTodayScreenTime } from '../lib/screen-time'
import { getBackgroundState, getBlockedDomains, getSettings, getStreakData } from '../lib/storage'
import { buildCalendarStatusMap, getGlobalStreakSummary, type CalendarDayStatus } from '../lib/streak'
import { getReachedMilestones, MILESTONES } from '../lib/streak-milestones'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import type { BlockRule, Settings } from '../lib/types'
import { PopupHeader } from './components/PopupHeader'
import { StreakCalendar } from '../components/StreakCalendar'
import { QuickActions } from './components/QuickActions'
import { ScreenTimeSection } from './components/ScreenTimeSection'

const BYPASS_DURATION_MINUTES = 15
const HOLD_DURATION_MS = 3000

type BypassReason = 'work' | 'urgent' | 'other'

type PopupScreenTimeState = {
  todayMinutes: number
  goalMinutes: number | null
  siteBreakdown: { domain: string; minutes: number }[]
  yesterdayMinutes: number | null
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getRelativeLocalDate(date: string, offsetDays: number): string {
  const target = new Date(`${date}T00:00:00`)
  target.setDate(target.getDate() + offsetDays)
  return formatLocalDate(target)
}

export function getHostnameFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    return parsed.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  const normalizedDomain = domain.toLowerCase()

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

export function getRulesMatchingHostname(
  rules: BlockRule[],
  hostname: string | null,
): BlockRule[] {
  if (!hostname) {
    return []
  }

  return rules.filter((rule) =>
    getBlockedDomains(rule).some((domain) => matchesDomain(hostname, domain)),
  )
}

async function getCurrentTabHostname(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return getHostnameFromUrl(tab?.url)
  } catch {
    return null
  }
}

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [screenTime, setScreenTime] = useState<PopupScreenTimeState>({
    todayMinutes: 0,
    goalMinutes: null,
    siteBreakdown: [],
    yesterdayMinutes: null,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)
  const [reflectionOpen, setReflectionOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState<BypassReason | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [streakDays, setStreakDays] = useState(0)
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, CalendarDayStatus>>({})
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const holdStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [
          loadedSettings,
          streakData,
          activeTrial,
          remainingTrialDays,
          backgroundState,
          licensePlan,
          currentHostname,
        ] = await Promise.all([
          getSettings(),
          getStreakData(),
          isTrialActive(),
          getTrialDaysRemaining(),
          getBackgroundState(),
          getEffectiveLicensePlan(),
          getCurrentTabHostname(),
        ])

        setTrialActive(activeTrial)
        setTrialDays(remainingTrialDays)
        const globalSummary = getGlobalStreakSummary(streakData)
        setStreakDays(globalSummary.current)
        setCalendarStatuses(buildCalendarStatusMap(globalSummary.records))
        const rulePlan = resolveRulePlanState({ trialActive: activeTrial, licensePlan })
        const activeRules = getActiveRules(loadedSettings.blockRules, {
          plan: rulePlan,
          freeActiveRuleIds: loadedSettings.freeActiveRuleIds,
        })
        const matchingRules = getRulesMatchingHostname(activeRules, currentHostname)

        const goalMinutes = loadedSettings.screenTimeGoal.enabled
          ? loadedSettings.screenTimeGoal.dailyLimitMinutes
          : null
        const todaySummary = getTodayScreenTime(backgroundState.dailyStats, goalMinutes)
        const todayDate = backgroundState.dailyStats?.date ?? new Date().toLocaleDateString('sv-SE')
        const yesterdayDate = getRelativeLocalDate(todayDate, -1)
        const yesterdayMinutes = backgroundState.dailyStatsHistory[yesterdayDate]
          ? Object.values(backgroundState.dailyStatsHistory[yesterdayDate].durations)
            .reduce((total, minutes) => total + minutes, 0)
          : null

        setScreenTime({
          todayMinutes: todaySummary.totalMinutes,
          goalMinutes: todaySummary.goalMinutes,
          siteBreakdown: todaySummary.siteBreakdown,
          yesterdayMinutes,
        })
        setSettings({
          ...loadedSettings,
          blockRules: matchingRules,
        })
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current !== null) {
        window.clearTimeout(holdTimeoutRef.current)
      }
      if (holdIntervalRef.current !== null) {
        window.clearInterval(holdIntervalRef.current)
      }
    }
  }, [])

  const activeRules = settings?.blockRules ?? []

  function resetHoldState() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    holdStartedAtRef.current = null
    setIsHolding(false)
    setHoldProgress(0)
  }

  async function confirmTemporaryBypass() {
    if (selectedReason === null || isSubmitting || activeRules.length === 0) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    resetHoldState()

    try {
      await Promise.all(
        activeRules.map((rule) => startTemporaryBypass(rule.id, BYPASS_DURATION_MINUTES)),
      )
      setReflectionOpen(false)
    } catch {
      setSubmitError('一時解除の保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  function startHold() {
    if (selectedReason === null || isSubmitting) {
      return
    }

    resetHoldState()
    setIsHolding(true)
    holdStartedAtRef.current = Date.now()
    holdIntervalRef.current = window.setInterval(() => {
      const startedAt = holdStartedAtRef.current
      if (startedAt === null) {
        return
      }

      const elapsed = Date.now() - startedAt
      setHoldProgress(Math.min(100, (elapsed / HOLD_DURATION_MS) * 100))
    }, 100)
    holdTimeoutRef.current = window.setTimeout(() => {
      void confirmTemporaryBypass()
    }, HOLD_DURATION_MS)
  }

  function stopHold() {
    if (isSubmitting) {
      return
    }

    resetHoldState()
  }

  function openReflectionCard() {
    setSelectedReason(null)
    setSubmitError(null)
    resetHoldState()
    setReflectionOpen(true)
  }

  function closeReflectionCard() {
    resetHoldState()
    setReflectionOpen(false)
  }

  if (loading) {
    return <div className="w-[360px]" />
  }

  if (loadError) {
    return <div className="w-[360px] p-4 text-sm text-gray-500">読み込みに失敗しました</div>
  }

  return (
    <div className="w-[360px] space-y-3 bg-white p-4">
      <PopupHeader trialActive={trialActive} trialDays={trialDays} />
      <ScreenTimeSection
        todayMinutes={screenTime.todayMinutes}
        goalMinutes={screenTime.goalMinutes}
        siteBreakdown={screenTime.siteBreakdown}
        yesterdayMinutes={screenTime.yesterdayMinutes}
      />
      <StreakCalendar
        streakDays={streakDays}
        statuses={calendarStatuses}
        onTodayClick={openReflectionCard}
      />
      {streakDays > 0 && (() => {
        const nextMilestone = MILESTONES.find((m) => m > streakDays) ?? null
        const prevMilestone = [...MILESTONES].reverse().find((m) => m <= streakDays) ?? 0
        const percent = nextMilestone
          ? ((streakDays - prevMilestone) / (nextMilestone - prevMilestone)) * 100
          : 100
        const reached = getReachedMilestones(streakDays)
        const latestReached = reached.length > 0 ? reached[reached.length - 1] : null
        return (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              {latestReached && streakDays === latestReached.milestone ? (
                <p className="text-xs font-medium text-gray-900">{latestReached.milestone}日達成!</p>
              ) : nextMilestone ? (
                <p className="text-xs font-medium text-gray-900">次の目標: {nextMilestone}日</p>
              ) : (
                <p className="text-xs font-medium text-gray-900">全マイルストーン達成</p>
              )}
              {nextMilestone ? (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              ) : null}
            </div>
            {nextMilestone ? (
              <span className="text-[10px] text-gray-400">{streakDays}/{nextMilestone}日</span>
            ) : null}
          </div>
        )
      })()}
      <QuickActions />
      <Dialog open={reflectionOpen} onClose={closeReflectionCard}>
        <div className="space-y-5 p-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
              🫣
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">本当にアクセスしますか？</h2>
              <p className="mt-1 text-sm text-gray-500">
                いまのストリークは <span className="font-semibold text-gray-900">{streakDays}日</span> です
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ストリークに一時解除として記録されます
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">
              Reason
            </p>
            <div className="grid gap-2">
              {[
                { id: 'work' as const, label: '仕事で必要', note: '作業や確認のため' },
                { id: 'urgent' as const, label: '緊急連絡', note: '急ぎの返信や確認' },
                { id: 'other' as const, label: 'その他', note: '例外的に確認したい' },
              ].map((reason) => {
                const selected = selectedReason === reason.id

                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setSelectedReason(reason.id)}
                    className={[
                      'rounded-xl border px-4 py-3 text-left transition-all duration-200',
                      selected
                        ? 'border-blue-500 bg-blue-50 shadow-[0_10px_25px_rgba(37,99,235,0.10)]'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold text-gray-900">{reason.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{reason.note}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {submitError ? (
            <p className="text-sm text-red-600">{submitError}</p>
          ) : null}

          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-100"
                style={{ width: `${holdProgress}%` }}
              />
            </div>
            <Button
              variant="primary"
              className="w-full bg-amber-500 hover:bg-amber-600 focus:ring-amber-200"
              disabled={selectedReason === null || isSubmitting || activeRules.length === 0}
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={startHold}
              onTouchEnd={stopHold}
              onTouchCancel={stopHold}
            >
              {isSubmitting
                ? '保存中...'
                : isHolding
                  ? 'そのまま3秒長押しで確定'
                  : '3秒長押しで一時解除'}
            </Button>
            {activeRules.length === 0 ? (
              <p className="text-center text-xs text-gray-500">
                一時解除できる有効ルールがありません
              </p>
            ) : null}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
