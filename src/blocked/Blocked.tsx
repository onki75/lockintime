import { useState } from 'react'
import { ShieldOff } from 'lucide-react'

import { Button } from '../components/Button'
import { getRandomQuote } from '../lib/quotes'

export function Blocked() {
  const params = new URLSearchParams(window.location.search)
  const blockedUrl = params.get('url') || '不明なサイト'
  const ruleId = params.get('ruleId')
  const filter = params.get('filter')
  const [quote] = useState(() => getRandomQuote())

  const restrictionMessage =
    filter === 'adult'
      ? '成人向けフィルタによりアクセスが制限されています'
      : ruleId
        ? 'ルールによりアクセスが制限されています'
        : 'アクセスが制限されています'

  const handleBypass = () => {
    window.close()
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
        <div className="bg-blue-50 rounded-lg px-5 py-3 inline-block">
          <p className="text-blue-600 text-sm italic">「{quote}」</p>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button variant="secondary" onClick={handleBypass}>
            ⏱ 5分だけアクセスする
          </Button>
        </div>
      </div>
    </div>
  )
}
