import { Shield } from 'lucide-react'
import { Button } from '../../components/Button'
import type { BlockRule } from '../../lib/types'

type HeaderProps = {
  rules: BlockRule[]
  isTrialActive: boolean
  trialDaysRemaining: number
}

export function Header({ rules, isTrialActive, trialDaysRemaining }: HeaderProps) {
  const ruleCount = rules.length
  const maxFree = 5

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">LockInTime</h1>
      </div>
      <div className="flex items-center gap-4">
        {isTrialActive ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            🎉 Proトライアル中（残り{trialDaysRemaining}日） ルール: 無制限
          </span>
        ) : (
          <>
            <span className="text-sm text-gray-500">プラン: Free</span>
            <span className="text-sm text-gray-500">ルール: {ruleCount} / {maxFree}件</span>
            <Button variant="primary" size="sm">
              Proにアップグレード
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
