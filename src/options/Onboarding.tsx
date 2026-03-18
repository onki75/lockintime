import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { finishOnboarding } from '../lib/onboarding'
import { presets } from '../lib/presets'
import type { UIMode } from '../lib/types'

type GoalId = 'work' | 'study' | 'social-detox' | 'health'

type GoalOption = {
  id: GoalId
  emoji: string
  label: string
  message: string
}

const goalOptions: GoalOption[] = [
  {
    id: 'work',
    emoji: '💼',
    label: '仕事に集中',
    message: '仕事',
  },
  {
    id: 'study',
    emoji: '📚',
    label: '勉強に集中',
    message: '勉強',
  },
  {
    id: 'social-detox',
    emoji: '📱',
    label: 'SNS断ち',
    message: 'SNS断ち',
  },
  {
    id: 'health',
    emoji: '🌙',
    label: '健康的な生活',
    message: '健康的な生活',
  },
]

const goalPresetMap: Record<GoalId, string[]> = {
  work: ['SNS', '動画', '掲示板・まとめ'],
  study: ['SNS', '動画', '漫画・小説'],
  'social-detox': ['SNS'],
  health: ['SNS', '動画'],
}

function getSitesForGoal(goalId: GoalId): string[] {
  const presetNames = goalPresetMap[goalId]
  const siteSet = new Set<string>()

  for (const presetName of presetNames) {
    const preset = presets.find((item) => item.name === presetName)

    if (!preset) {
      continue
    }

    for (const site of preset.sites) {
      siteSet.add(site)
    }
  }

  return [...siteSet]
}

type WelcomeStepProps = {
  selectedGoalId: GoalId | null
  selectedUIMode: UIMode
  onSelectGoal: (goalId: GoalId) => void
  onSelectUIMode: (mode: UIMode) => void
  onNext: () => void
}

function WelcomeStep({
  selectedGoalId,
  selectedUIMode,
  onSelectGoal,
  onSelectUIMode,
  onNext,
}: WelcomeStepProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-10">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-green-200/30 blur-3xl" />
      <div className="relative flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-4xl shadow-[0_16px_30px_rgba(22,163,74,0.28)]">
          😊
        </div>
        <div className="mt-6 w-full max-w-xl rounded-xl bg-green-50 p-6 text-center">
          <p className="text-xl font-semibold tracking-tight text-slate-900">
            やあ！LockInTimeへようこそ
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            最初に目標を選ぶだけで、今日からすぐに集中モードを始められます。
          </p>
        </div>
        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          🎉 Pro全機能を7日間無料で体験できます
        </div>
      </div>

      <div className="relative mt-8">
        <div className="mb-3 text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Goal
        </div>
        <div className="grid grid-cols-2 gap-2">
          {goalOptions.map((goal) => {
            const selected = goal.id === selectedGoalId

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => {
                  onSelectGoal(goal.id)
                }}
                className={[
                  'rounded-xl p-4 text-center transition-all duration-200 cursor-pointer',
                  selected
                    ? 'border-2 border-blue-600 bg-blue-50 shadow-[0_14px_30px_rgba(37,99,235,0.12)]'
                    : 'border border-gray-200 bg-white hover:border-blue-200 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="text-2xl">{goal.emoji}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {goal.label}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative mt-8">
        <div className="mb-3 text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          UI Mode
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              id: 'mascot' as const,
              title: '🐣 マスコットモード',
              description: 'キャラと一緒に楽しく続ける',
              badge: 'おすすめ',
            },
            {
              id: 'simple' as const,
              title: '🛡 シンプルモード',
              description: 'すっきりしたビジネス向けUI',
              badge: null,
            },
          ].map((mode) => {
            const selected = selectedUIMode === mode.id

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onSelectUIMode(mode.id)
                }}
                className={[
                  'rounded-2xl border p-5 text-left transition-all duration-200',
                  selected
                    ? 'border-blue-500 bg-blue-50 shadow-[0_14px_30px_rgba(37,99,235,0.12)]'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{mode.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {mode.description}
                    </p>
                  </div>
                  {mode.badge ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      {mode.badge}
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          あとから設定で変更できます
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          disabled={selectedGoalId === null}
          className="min-w-36 shadow-[0_18px_35px_rgba(37,99,235,0.22)]"
          onClick={onNext}
        >
          次へ →
        </Button>
      </div>
    </section>
  )
}

type SiteChecklistProps = {
  sites: string[]
  selectedSites: string[]
  onToggleSite: (site: string) => void
}

function SiteChecklist({
  sites,
  selectedSites,
  onToggleSite,
}: SiteChecklistProps) {
  return (
    <>
      {sites.map((site) => {
        const checked = selectedSites.includes(site)

        return (
          <label
            key={site}
            className={[
              'flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-200',
              checked
                ? 'border border-blue-200 bg-blue-50'
                : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onToggleSite(site)
              }}
              className="sr-only"
            />
            <span
              className={[
                'flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold transition-colors duration-200',
                checked
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-transparent',
              ].join(' ')}
            >
              ✓
            </span>
            <span className="text-sm font-medium text-slate-800">{site}</span>
          </label>
        )
      })}
    </>
  )
}

type CompleteStepProps = {
  blockedCount: number
  completionError: string | null
}

function CompleteStep({ blockedCount, completionError }: CompleteStepProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-10">
      <div className="pointer-events-none absolute left-8 top-4 h-24 w-24 rounded-full bg-green-200/40 blur-3xl" />
      <div className="relative flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-4xl shadow-[0_16px_30px_rgba(22,163,74,0.28)]">
          🎉
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
          準備完了！
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600">
          {blockedCount}サイトのブロックを開始しました
        </p>
      </div>

      <div className="relative mt-8 rounded-xl bg-green-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-green-700 uppercase">
              Day 1
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              🔥今日がDay 1!
            </p>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                className={[
                  'h-4 w-4 rounded-sm',
                  index === 0 ? 'bg-green-500' : 'bg-slate-300',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </div>

      {completionError ? (
        <p className="mt-4 text-sm text-amber-700">
          オンボーディング完了状態の保存に失敗しました。設定ページは開けますが、再表示される可能性があります。
        </p>
      ) : null}

      <div className="mt-8 flex justify-center">
        <Button
          variant="primary"
          size="lg"
          className="min-w-48 shadow-[0_18px_35px_rgba(37,99,235,0.22)]"
          onClick={() => {
            window.location.href = 'options.html'
          }}
        >
          設定ページを開く
        </Button>
      </div>
    </section>
  )
}

export function Onboarding() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedGoalId, setSelectedGoalId] = useState<GoalId | null>(null)
  const [selectedUIMode, setSelectedUIMode] = useState<UIMode>('mascot')
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [blockedCount, setBlockedCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const selectedGoal = useMemo(
    () => goalOptions.find((goal) => goal.id === selectedGoalId) ?? null,
    [selectedGoalId],
  )

  const availableSites = useMemo(() => {
    if (selectedGoalId === null) {
      return []
    }

    return getSitesForGoal(selectedGoalId)
  }, [selectedGoalId])

  function handleSelectGoal(goalId: GoalId) {
    setSelectedGoalId(goalId)
    setSelectedSites(getSitesForGoal(goalId))
    setSaveError(null)
  }

  function handleToggleSite(site: string) {
    setSelectedSites((current) =>
      current.includes(site)
        ? current.filter((item) => item !== site)
        : [...current, site],
    )
  }

  async function handleStartBlocking() {
    if (selectedSites.length === 0) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const result = await finishOnboarding(selectedSites, selectedUIMode)
      setCompletionError(result.onboardingCompleted ? null : 'failed')
      setBlockedCount(result.blockedCount)
      setStep(3)
    } catch {
      setSaveError('設定の保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              LockInTime
            </p>
            <p className="mt-1 text-sm text-slate-600">
              3ステップで初期設定を完了します
            </p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((value) => (
              <span
                key={value}
                className={[
                  'h-2.5 w-10 rounded-full transition-all duration-300',
                  value <= step ? 'bg-blue-600' : 'bg-slate-200',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {step === 1 ? (
          <WelcomeStep
            selectedGoalId={selectedGoalId}
            selectedUIMode={selectedUIMode}
            onSelectGoal={handleSelectGoal}
            onSelectUIMode={setSelectedUIMode}
            onNext={() => {
              if (selectedGoalId !== null) {
                setStep(2)
              }
            }}
          />
        ) : null}

        {step === 2 && selectedGoal ? (
          <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-10">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-2xl shadow-[0_12px_24px_rgba(22,163,74,0.24)]">
                😊
              </div>
              <div className="flex-1 rounded-xl bg-green-50 p-5">
                <p className="text-lg font-semibold text-slate-900">
                  「{selectedGoal.message}ならこのサイトをブロックしよう！」
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  提案されたサイトだけを選んで始められます。不要ならチェックを外してください。
                </p>
              </div>
            </div>

            <div className="relative mt-8 grid gap-3">
              <SiteChecklist
                sites={availableSites}
                selectedSites={selectedSites}
                onToggleSite={handleToggleSite}
              />
            </div>

            {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                }}
                className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline"
              >
                ← 戻る
              </button>
              <Button
                variant="primary"
                size="lg"
                disabled={selectedSites.length === 0 || isSaving}
                className="min-w-40 shadow-[0_18px_35px_rgba(37,99,235,0.22)]"
                onClick={() => {
                  void handleStartBlocking()
                }}
              >
                {isSaving ? '保存中...' : 'ブロック開始→'}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <CompleteStep
            blockedCount={blockedCount}
            completionError={completionError}
          />
        ) : null}
      </div>
    </div>
  )
}
