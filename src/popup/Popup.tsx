import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { startTemporaryBypass } from '../lib/bypass'
import { getSettings, getStreakData } from '../lib/storage'
import { buildCalendarStatusMap, getGlobalStreakSummary } from '../lib/streak'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import type { Settings } from '../lib/types'
import { PopupHeader } from './components/PopupHeader'
import { StreakCalendar } from '../components/StreakCalendar'
import { QuickActions } from './components/QuickActions'

const BYPASS_DURATION_MINUTES = 15
const HOLD_DURATION_MS = 3000

type BypassReason = 'work' | 'urgent' | 'other'

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null)
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
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, 'success' | 'failure' | 'future' | 'empty'>>({})
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const holdStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [loadedSettings, streakData, activeTrial, remainingTrialDays] = await Promise.all([
          getSettings(),
          getStreakData(),
          isTrialActive(),
          getTrialDaysRemaining(),
        ])

        setSettings(loadedSettings)
        setTrialActive(activeTrial)
        setTrialDays(remainingTrialDays)
        const globalSummary = getGlobalStreakSummary(streakData)
        setStreakDays(globalSummary.current)
        setCalendarStatuses(buildCalendarStatusMap(globalSummary.records))
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

  const enabledRules = settings?.blockRules.filter((rule) => rule.enabled) ?? []

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
    if (selectedReason === null || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    resetHoldState()

    try {
      await Promise.all(
        enabledRules.map((rule) => startTemporaryBypass(rule.id, BYPASS_DURATION_MINUTES)),
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
      <StreakCalendar
        streakDays={streakDays}
        statuses={calendarStatuses}
        onTodayClick={openReflectionCard}
      />
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
              disabled={selectedReason === null || isSubmitting || enabledRules.length === 0}
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
            {enabledRules.length === 0 ? (
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
