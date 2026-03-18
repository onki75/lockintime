import { ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { LockModeDialog } from '../../components/dialogs/LockModeDialog'
import { NuclearActiveState } from '../../components/dialogs/NuclearActiveState'
import {
  cancelDelayedUnlock,
  configureLockMode,
  getLockModeKind,
  getLockStatus,
  requestDelayedUnlock,
} from '../../lib/lock'
import type { LockModeSettings } from '../../lib/types'

type LockModeSectionProps = {
  lockMode: LockModeSettings
}

const modeLabelMap = {
  off: 'OFF',
  password: 'パスワード',
  text_challenge: 'テキストチャレンジ',
  nuclear: 'Nuclear',
} satisfies Record<string, string>

export function LockModeSection({ lockMode }: LockModeSectionProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'save' | 'cancel' | 'request' | null>(null)

  const status = useMemo(() => getLockStatus(lockMode), [lockMode])
  const currentModeLabel = modeLabelMap[getLockModeKind(lockMode)]

  function requestCurrentSecret() {
    if (status.requiresPassword) {
      return window.prompt('現在のパスワードを入力してください') ?? ''
    }

    if (status.requiresChallenge) {
      return window.prompt('現在の確認文字列を入力してください') ?? ''
    }

    return undefined
  }

  async function handleSave(
    mode: string,
    password?: string,
    duration?: number,
    challengeText?: string,
  ) {
    setPending('save')
    setError(null)
    try {
      const currentSecret = requestCurrentSecret()
      await configureLockMode(mode as 'off' | 'password' | 'text_challenge' | 'nuclear', {
        currentSecret,
        challengeText,
        password,
        nuclearDurationHours: duration,
      })
    } catch (nextError) {
      setError((nextError as Error).message)
      throw nextError
    } finally {
      setPending(null)
    }
  }

  async function handleRequestDelayedUnlock() {
    setPending('request')
    setError(null)
    try {
      await requestDelayedUnlock(requestCurrentSecret())
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPending(null)
    }
  }

  async function handleCancelDelayUnlock() {
    setPending('cancel')
    setError(null)
    try {
      await cancelDelayedUnlock()
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
            Lock
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">ロックモード</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            設定変更そのものに摩擦をかけます。環境を崩しにくくする backend 設定です。
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={pending === 'save'}>
          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> モードを変更
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          現在: {currentModeLabel}
        </span>
        {status.nuclearUntil ? (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            Nuclear 有効中
          </span>
        ) : null}
        {status.delayUnlockUntil ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            解除待機中
          </span>
        ) : null}
      </div>

      <NuclearActiveState
        nuclearEndTime={status.nuclearUntil ?? undefined}
        delayUnlockEndTime={status.delayUnlockUntil ?? undefined}
        onCancelDelay={
          status.delayUnlockUntil
            ? () => {
                void handleCancelDelayUnlock()
              }
            : undefined
        }
      />

      {!status.nuclearUntil && !status.delayUnlockUntil && lockMode.enabled ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleRequestDelayedUnlock()}
          disabled={pending === 'request'}
        >
          ロックを解除
        </Button>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <LockModeDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </section>
  )
}
