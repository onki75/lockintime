import { Crown } from 'lucide-react'
import { Button } from '../../components/Button'
import type { BlockRule } from '../../lib/types'

type PlanAccountProps = {
  rules: BlockRule[]
  isTrialActive: boolean
  trialDaysRemaining: number
}

export function PlanAccount({ rules, isTrialActive, trialDaysRemaining }: PlanAccountProps) {
  const ruleCount = rules.length
  const maxFree = 5

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">プラン</h2>
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {isTrialActive ? (
            <>
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="font-semibold text-gray-900">Proトライアル中</p>
                  <p className="text-sm text-gray-500">残り{trialDaysRemaining}日 — 全機能が利用可能</p>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-700">
                  トライアル終了後はFreeプラン（5件まで）に移行します。
                  今のうちにProプランを検討してみてください。
                </p>
              </div>
              <Button variant="primary">Proプランを見る</Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <span className="text-sm font-bold text-gray-500">F</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Freeプラン</p>
                  <p className="text-sm text-gray-500">基本機能が利用可能</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">ブロックルール</span>
                  <span className="font-medium text-gray-900">{ruleCount} / {maxFree}件</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, (ruleCount / maxFree) * 100)}%` }}
                  />
                </div>
              </div>
              <Button variant="primary">
                <Crown className="mr-1.5 h-4 w-4" /> Proにアップグレード
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">アカウント</h2>
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            複数デバイスで設定やストリークを同期するにはCloudプランが必要です。
          </p>
          <Button variant="secondary" size="sm" className="mt-3" disabled>
            🔒 Googleアカウントでログイン (Cloud)
          </Button>
        </div>
      </div>
    </div>
  )
}
