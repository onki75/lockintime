import { useState } from 'react'
import { Crown } from 'lucide-react'
import UpgradeDialog from '../../components/dialogs/UpgradeDialog'
import { Button } from '../../components/Button'
import type { BlockRule } from '../../lib/types'
import type { RulePlanState } from '../../lib/rule-activation'
import { getActiveRuleCount } from '../../lib/rule-activation'

type PlanAccountProps = {
  rules: BlockRule[]
  plan: RulePlanState
  freeActiveRuleIds: string[]
  isTrialActive: boolean
  trialDaysRemaining: number
  onManageFreeRules: () => void
}

export function PlanAccount({
  rules,
  plan,
  freeActiveRuleIds,
  isTrialActive,
  trialDaysRemaining,
  onManageFreeRules,
}: PlanAccountProps) {
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState<boolean>(false)
  const ruleCount = rules.length
  const maxFree = 5
  const activeRuleCount = getActiveRuleCount(rules, { plan, freeActiveRuleIds })

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
              <Button variant="primary" onClick={() => setIsUpgradeDialogOpen(true)}>
                Proプランを見る
              </Button>
            </>
          ) : plan === 'pro' ? (
            <>
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="font-semibold text-gray-900">Proプラン</p>
                  <p className="text-sm text-gray-500">全機能が利用可能</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">ブロックルール</span>
                  <span className="font-medium text-gray-900">{rules.length}件有効</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  Pro機能が有効です。Freeの5件制限や機能ロックは適用されません。
                </p>
              </div>
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
                  <span className="font-medium text-gray-900">{activeRuleCount} / {maxFree}件有効</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, (activeRuleCount / maxFree) * 100)}%` }}
                  />
                </div>
              </div>
              {ruleCount > 0 ? (
                <Button variant="secondary" onClick={onManageFreeRules}>
                  有効ルールを選ぶ
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => setIsUpgradeDialogOpen(true)}>
                <Crown className="mr-1.5 h-4 w-4" /> Proにアップグレード
              </Button>
            </>
          )}
        </div>
      </div>

      <UpgradeDialog
        open={isUpgradeDialogOpen}
        onClose={() => setIsUpgradeDialogOpen(false)}
      />
    </div>
  )
}
