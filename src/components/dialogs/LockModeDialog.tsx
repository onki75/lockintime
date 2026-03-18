import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type LockMode = 'off' | 'password' | 'text_challenge' | 'nuclear'

type LockModeDialogProps = {
  open: boolean
  onClose: () => void
  onSave: (
    mode: LockMode,
    password?: string,
    duration?: number,
    challengeText?: string,
  ) => void
}

type LockOption = {
  value: LockMode
  title: string
  description: string
  accentClass?: string
}

const lockOptions: LockOption[] = [
  {
    value: 'off',
    title: 'OFF',
    description: '追加のロックをかけず、通常どおり設定を利用します。',
  },
  {
    value: 'password',
    title: 'パスワード',
    description: '設定変更や解除時にパスワード入力を求めます。',
  },
  {
    value: 'text_challenge',
    title: 'テキストチャレンジ',
    description: '解除前にテキスト入力の確認ステップを追加します。',
  },
  {
    value: 'nuclear',
    title: '☢️ Nuclear Option',
    description: '設定した時間は解除不能にする強力なロックです。',
    accentClass: 'text-red-600',
  },
]

const nuclearDurations = [
  { label: '1時間', value: 1 },
  { label: '6時間', value: 6 },
  { label: '12時間', value: 12 },
  { label: '24時間', value: 24 },
]

export function LockModeDialog({ open, onClose, onSave }: LockModeDialogProps) {
  const [mode, setMode] = useState<LockMode>('off')
  const [password, setPassword] = useState('')
  const [duration, setDuration] = useState('1')

  useEffect(() => {
    if (!open) return
    setMode('off')
    setPassword('')
    setDuration('1')
  }, [open])

  const durationValue = Number(duration)
  const requiresPassword = mode === 'password'
  const requiresDuration = mode === 'nuclear'
  const canSave =
    (!requiresPassword || password.trim().length > 0) &&
    (!requiresDuration || Number.isFinite(durationValue))

  function handleSave() {
    if (!canSave) return

    onSave(mode, requiresPassword ? password : undefined, requiresDuration ? durationValue : undefined)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">ロックモード</h2>
          <p className="text-sm leading-6 text-gray-500">
            設定変更時の保護レベルを選択します。強いモードほど解除や変更に手間がかかります。
          </p>
        </div>

        <div className="space-y-3">
          {lockOptions.map((option) => {
            const selected = mode === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={[
                  'flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors',
                  selected
                    ? 'border-2 border-blue-600 bg-blue-50'
                    : 'border border-gray-200 bg-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-blue-600' : 'border-gray-300',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <span
                    className={[
                      'size-2.5 rounded-full',
                      selected ? 'bg-blue-600' : 'bg-transparent',
                    ].join(' ')}
                  />
                </span>

                <span className="min-w-0">
                  <span className={['block text-sm font-semibold', option.accentClass ?? 'text-gray-900'].join(' ')}>
                    {option.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-500">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        {mode === 'password' ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : null}

        {mode === 'nuclear' ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">有効期間</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {nuclearDurations.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Button variant="primary" className="w-full" onClick={handleSave} disabled={!canSave}>
          設定を保存
        </Button>
      </div>
    </Dialog>
  )
}
