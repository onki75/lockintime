import { ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getRandomQuote } from '../lib/quotes'
import { getSettings } from '../lib/storage'
import type { BlockRule, Settings } from '../lib/types'

type BlockedContext = {
  filter: string | null
  ruleId: string | null
  reason: string | null
  subReason: string | null
  url: string | null
  until: number | null
}

type SessionStatus = {
  ok: true
  maxCount: number
  usedCount: number
  remainingCount: number
  perSessionMinutes: number
  session: { ruleId: string; startedAt: number; elapsedMs: number; lastActiveAt: number | null } | null
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

function getReasonText(reason: string | null, subReason: string | null): string {
  if (reason === 'daily_count' && subReason === 'session_gate') {
    return '使用前に解除ボタンを押してください。'
  }

  if (reason === 'daily_count' && subReason === 'exhausted') {
    return '今日の使用回数を使い切りました。'
  }

  if (reason && reasonCopy[reason]) {
    return reasonCopy[reason]
  }

  return 'ブロックルールに一致しました。'
}

export function parseBlockedContext(search: string): BlockedContext {
  const params = new URLSearchParams(search)
  const rawUntil = params.get('until')
  const until = rawUntil === null ? null : Number(rawUntil)

  return {
    filter: params.get('filter'),
    ruleId: params.get('ruleId'),
    reason: params.get('reason'),
    subReason: params.get('subReason'),
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
    const reason = getReasonText(context.reason, context.subReason)
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

function buildSiteUrl(domain: string): string {
  if (/^https?:\/\//i.test(domain)) {
    return domain
  }
  return `https://${domain}`
}

export function Blocked() {
  const context = parseBlockedContext(window.location.search)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const isSessionGate =
    context.reason === 'daily_count' &&
    context.subReason === 'session_gate' &&
    context.ruleId !== null

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

  useEffect(() => {
    if (!context.ruleId || context.reason !== 'daily_count') {
      return
    }

    let active = true

    void chrome.runtime
      .sendMessage({ type: 'daily-count-session:status', ruleId: context.ruleId })
      .then((response: unknown) => {
        if (!active) return
        if (response && typeof response === 'object' && 'ok' in response && (response as { ok: unknown }).ok === true) {
          setSessionStatus(response as SessionStatus)
        }
      })
      .catch(() => {
        // ignore
      })

    return () => {
      active = false
    }
  }, [context.ruleId, context.reason])

  const rule = findRule(settings, context.ruleId)
  const copy = getBlockedCopy(context, rule)
  const blockedUrl = context.url || '不明なサイト'

  const handleStartSession = async () => {
    if (!context.ruleId || !context.url || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'daily-count-session:start',
        ruleId: context.ruleId,
      })) as { ok: boolean; error?: string }

      if (response?.ok) {
        window.location.replace(buildSiteUrl(context.url))
        return
      }

      setStartError(response?.error ?? 'セッションを開始できませんでした')
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'セッションを開始できませんでした')
    } finally {
      setStarting(false)
    }
  }

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
        {isSessionGate && sessionStatus && sessionStatus.remainingCount > 0 ? (
          <div className="rounded-2xl border border-blue-200 bg-white px-5 py-5 space-y-3 shadow-sm">
            <p className="text-sm text-gray-700">
              今日はあと <span className="font-bold text-blue-600">{sessionStatus.remainingCount}</span> / {sessionStatus.maxCount} 回使えます
            </p>
            <button
              type="button"
              onClick={handleStartSession}
              disabled={starting}
              className="w-full rounded-full bg-blue-600 px-5 py-2.5 font-semibold text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? '開始中…' : `${sessionStatus.perSessionMinutes}分間使う`}
            </button>
            {startError ? <p className="text-xs text-red-500">{startError}</p> : null}
          </div>
        ) : null}
        {isSessionGate && sessionStatus && sessionStatus.remainingCount === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            今日の使用回数を使い切りました。明日 0:00 にリセットされます。
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
