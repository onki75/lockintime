import { Monitor, Plus, Quote, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { saveSettings } from '../../lib/storage'
import type { CustomQuote, Settings, StreakDisplayMode, UIMode } from '../../lib/types'

type DisplaySettingsProps = {
  settings: Settings
}

type SaveState = 'idle' | 'saving' | 'error'

const streakOptions: Array<{
  value: StreakDisplayMode
  label: string
  description: string
}> = [
  {
    value: 'heatmap',
    label: '📊 ヒートマップ',
    description: '日ごとの流れをカレンダーで確認します。',
  },
  {
    value: 'number',
    label: '🔢 数字',
    description: '連続日数をシンプルに表示します。',
  },
]

const uiModeOptions: Array<{
  value: UIMode
  label: string
  description: string
}> = [
  {
    value: 'mascot',
    label: '🐣 マスコット',
    description: 'マスコットと一緒に継続を見守ります。',
  },
  {
    value: 'simple',
    label: '📋 シンプル',
    description: '情報を最小限にして集中しやすくします。',
  },
]

function RadioCardGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string; description: string }>
  onChange: (nextValue: T) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded-2xl border px-4 py-4 text-left transition-all duration-200',
              selected
                ? 'border-blue-500 bg-blue-50 shadow-[0_12px_30px_rgba(37,99,235,0.10)]'
                : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50',
            ].join(' ')}
            aria-pressed={selected}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                  selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white',
                ].join(' ')}
              >
                <div className={selected ? 'h-2 w-2 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-transparent'} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{option.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function DisplaySettings({ settings }: DisplaySettingsProps) {
  const [draftSettings, setDraftSettings] = useState(settings)
  const [newQuote, setNewQuote] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  async function persistSettings(nextSettings: Settings) {
    setDraftSettings(nextSettings)
    setSaveState('saving')

    try {
      await saveSettings(nextSettings)
      setSaveState('idle')
    } catch (error) {
      console.error(error)
      setSaveState('error')
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const nextSettings = {
      ...draftSettings,
      [key]: value,
      updatedAt: Date.now(),
    }

    void persistSettings(nextSettings)
  }

  function handleAddQuote() {
    const trimmedQuote = newQuote.trim()

    if (!trimmedQuote) {
      return
    }

    const now = Date.now()
    const nextQuote: CustomQuote = {
      id: crypto.randomUUID(),
      content: trimmedQuote,
      createdAt: now,
      updatedAt: now,
    }

    void persistSettings({
      ...draftSettings,
      customQuotes: [...draftSettings.customQuotes, nextQuote],
      updatedAt: now,
    })
    setNewQuote('')
  }

  function handleDeleteQuote(quoteId: string) {
    const nextQuotes = draftSettings.customQuotes.filter((quote) => quote.id !== quoteId)

    void persistSettings({
      ...draftSettings,
      customQuotes: nextQuotes,
      updatedAt: Date.now(),
    })
  }

  return (
    <section className="space-y-6 rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
          <Monitor className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">表示設定</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            ストリークの見せ方と、日々の励ましメッセージを調整できます。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">ストリーク表示</h3>
        </div>
        <RadioCardGroup
          value={draftSettings.streakDisplayMode}
          options={streakOptions}
          onChange={(value) => updateSetting('streakDisplayMode', value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">UIモード</h3>
        </div>
        <RadioCardGroup
          value={draftSettings.uiMode}
          options={uiModeOptions}
          onChange={(value) => updateSetting('uiMode', value)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-blue-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">カスタム名言</h3>
            <p className="text-xs text-gray-500">自分向けの一言を追加できます。</p>
          </div>
        </div>

        <div className="space-y-2">
          {draftSettings.customQuotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              まだカスタム名言はありません。
            </div>
          ) : (
            draftSettings.customQuotes.map((quote) => (
              <div
                key={quote.id}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 px-4 py-3"
              >
                <p className="min-w-0 flex-1 text-sm leading-6 text-gray-700">{quote.content}</p>
                <button
                  type="button"
                  onClick={() => handleDeleteQuote(quote.id)}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="名言を削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={newQuote}
            onChange={(event) => setNewQuote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddQuote()
              }
            }}
            placeholder="例: 今日は1回だけ我慢すれば勝ち"
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <Button variant="secondary" onClick={handleAddQuote} disabled={!newQuote.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> 追加
          </Button>
        </div>

        {saveState === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            表示設定の保存に失敗しました。もう一度お試しください。
          </div>
        ) : null}
      </div>
    </section>
  )
}
