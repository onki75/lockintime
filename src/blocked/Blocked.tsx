import { ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getRandomQuote } from '../lib/quotes'
import { getSettings } from '../lib/storage'
import type { BlockRule, Settings } from '../lib/types'

type BlockedContext = {
  filter: string | null
  ruleId: string | null
  reason: string | null
  url: string | null
  until: number | null
}

type BlockedCopy = {
  title: string
  description: string
  detail: string | null
}

const reasonCopy: Record<string, string> = {
  full_block: '常時ブロックのルールに一致しました。',
  time_of_day: 'この時間帯はアクセスできない設定です。',
  daily_count: '今日のアクセス回数上限に達しました。',
  daily_duration: '今日の利用時間上限に達しました。',
  cooldown: 'クールダウン中のため、まだアクセスできません。',
  location: '現在地に基づく制限が有効です。',
}

export function parseBlockedContext(search: string): BlockedContext {
  const params = new URLSearchParams(search)
  const rawUntil = params.get('until')
  const until = rawUntil === null ? null : Number(rawUntil)

  return {
    filter: params.get('filter'),
    ruleId: params.get('ruleId'),
    reason: params.get('reason'),
    url: params.get('url'),
    until: until !== null && Number.isFinite(until) ? until : null,
  }
}

function formatUntil(until: number | null): string | null {
  if (until === null) {
    return null
  }

  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(until))
}

function getRuleName(rule: BlockRule | null): string | null {
  if (!rule) {
    return null
  }

  return rule.type === 'group' ? rule.name : rule.url
}

export function getBlockedCopy(context: BlockedContext, rule: BlockRule | null): BlockedCopy {
  if (context.filter === 'adult') {
    return {
      title: '成人向けサイトをブロックしました',
      description: '成人向けフィルターがこのページへのアクセスを止めました。',
      detail: '必要な場合はオプション画面で成人向けフィルター設定を確認できます。',
    }
  }

  const ruleName = getRuleName(rule)
  if (context.ruleId || ruleName) {
    const reason = context.reason ? reasonCopy[context.reason] ?? 'ブロックルールに一致しました。' : 'ブロックルールに一致しました。'
    const until = formatUntil(context.until)

    return {
      title: 'このサイトはブロック中です',
      description: ruleName ? `「${ruleName}」のルールが適用されています。` : '保存済みルールがこのページへのアクセスを止めました。',
      detail: until ? `${reason} ${until}まで有効です。` : reason,
    }
  }

  return {
    title: 'このページはブロックされました',
    description: 'LockInTimeがこのページへのアクセスを止めました。',
    detail: null,
  }
}

function findRule(settings: Settings | null, ruleId: string | null): BlockRule | null {
  if (!settings || !ruleId) {
    return null
  }

  return settings.blockRules.find((rule) => rule.id === ruleId) ?? null
}

export function Blocked() {
  const context = parseBlockedContext(window.location.search)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void getSettings()
      .then((loadedSettings) => {
        if (!active) return
        setSettings(loadedSettings)
        setQuote(loadedSettings.customQuotes[0]?.content ?? getRandomQuote())
      })
      .catch(() => {
        if (!active) return
        setQuote(getRandomQuote())
      })

    return () => {
      active = false
    }
  }, [])

  const rule = findRule(settings, context.ruleId)
  const copy = getBlockedCopy(context, rule)
  const blockedUrl = context.url || '不明なサイト'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-lg">
        <ShieldOff className="mx-auto w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-800">
          {copy.title}
        </h1>
        <p className="text-gray-600">{copy.description}</p>
        <p className="text-gray-500 break-all">{blockedUrl}</p>
        {copy.detail ? (
          <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            {copy.detail}
          </p>
        ) : null}
        {quote ? (
          <blockquote className="rounded-2xl bg-white px-5 py-4 text-sm font-medium leading-6 text-gray-700 shadow-sm">
            {quote}
          </blockquote>
        ) : null}
      </div>
    </div>
  )
}
