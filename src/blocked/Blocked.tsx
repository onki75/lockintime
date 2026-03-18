import { useMemo, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { Button } from '../components/Button'
import { startTemporaryBypass } from '../lib/bypass'
import { normalizeRedirectHostname } from '../lib/navigation'
import { getRandomQuote } from '../lib/quotes'

export function Blocked() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const blockedUrl = params.get('url') || '不明なサイト'
  const ruleId = params.get('ruleId')
  const filter = params.get('filter')
  const until = params.get('until')
  const [quote] = useState(() => getRandomQuote())
  const [isBypassing, setIsBypassing] = useState(false)
  const [bypassError, setBypassError] = useState<string | null>(null)
  const safeHostname = normalizeRedirectHostname(blockedUrl)

  const restrictionMessage =
    filter === 'adult'
      ? '成人向けフィルタによりアクセスが制限されています'
      : ruleId
        ? 'ルールによりアクセスが制限されています'
        : 'アクセスが制限されています'

  async function handleTemporaryBypass() {
    if (!ruleId || !safeHostname || isBypassing) {
      return
    }

    setIsBypassing(true)
    setBypassError(null)

    try {
      await startTemporaryBypass(ruleId, 15)
      window.location.href = `https://${safeHostname}`
    } catch {
      setBypassError('一時解除に失敗しました。もう一度お試しください。')
      setIsBypassing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-lg">
        <ShieldOff className="mx-auto w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-800">
          このサイトはブロック中です
        </h1>
        <p className="text-gray-500 break-all">{blockedUrl}</p>
        <p className="text-gray-400 text-sm">{restrictionMessage}</p>
        {until ? (
          <p className="text-xs text-gray-400">
            制限終了予定: {new Date(Number(until)).toLocaleString('ja-JP')}
          </p>
        ) : null}
        <div className="bg-blue-50 rounded-lg px-5 py-3 inline-block">
          <p className="text-blue-600 text-sm italic">「{quote}」</p>
        </div>
        {ruleId && safeHostname ? (
          <div className="space-y-3">
            <Button
              variant="primary"
              disabled={isBypassing}
              onClick={() => {
                void handleTemporaryBypass()
              }}
            >
              {isBypassing ? '一時解除中...' : '15分だけ一時解除'}
            </Button>
            {bypassError ? <p className="text-sm text-red-600">{bypassError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
