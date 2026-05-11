import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { getDefaultFreeActiveRuleIds, isProLockedRule } from '../../lib/rule-activation'
import type { BlockRule, RestrictionConfig, RestrictionType } from '../../lib/types'

type TrialDowngradeDialogProps = {
  open: boolean
  onClose: () => void
  rules: BlockRule[]
  selectedRuleIds: string[]
  onConfirm: (selectedIds: string[]) => void
  title?: string
  description?: string
  confirmLabel?: string
  closeLabel?: string
}

const MAX_FREE_RULES = 5

const restrictionLabels: Record<RestrictionType, string> = {
  full_block: '完全ブロック',
  time_of_day: '使用時刻制限',
  daily_count: '使用回数制限',
  daily_duration: '使用時間制限',
  cooldown: 'クールダウン',
  delay: '遅延アクセス',
  location: '位置情報制限',
}

function getRestrictionSummary(restrictions: RestrictionConfig[]): string {
  const labels = restrictions.map((restriction) => restrictionLabels[restriction.type])
  return Array.from(new Set(labels)).join(' / ')
}

function getRuleLabel(rule: BlockRule): string {
  return rule.type === 'site' ? rule.url : `${rule.name} (${rule.urls.length}サイト)`
}

export function TrialDowngradeDialog({
  open,
  onClose,
  rules,
  selectedRuleIds,
  onConfirm,
  title = 'Proトライアルが終了しました',
  description = '無料プランでは5件まで有効にできます。有効にするルールを選んでください。',
  confirmLabel = '確定',
  closeLabel = 'Proを継続',
}: TrialDowngradeDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return

    const nextSelectedIds = selectedRuleIds.length > 0
      ? selectedRuleIds
      : getDefaultFreeActiveRuleIds(rules)

    setSelectedIds(new Set(nextSelectedIds))
  }, [open, rules, selectedRuleIds])

  function toggleRule(rule: BlockRule) {
    if (isProLockedRule(rule)) return

    setSelectedIds((prev) => {
      const next = new Set(prev)

      if (next.has(rule.id)) {
        next.delete(rule.id)
        return next
      }

      if (next.size >= MAX_FREE_RULES) {
        return prev
      }

      next.add(rule.id)
      return next
    })
  }

  function handleConfirm() {
    onConfirm(Array.from(selectedIds))
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Timer className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm leading-6 text-gray-600">
              {description}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-blue-600">
            選択中: {selectedIds.size} / {MAX_FREE_RULES}件
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto p-3">
            {rules.map((rule) => {
              const locked = isProLockedRule(rule)
              const checked = selectedIds.has(rule.id)
              const disabled = locked || (!checked && selectedIds.size >= MAX_FREE_RULES)

              return (
                <label
                  key={rule.id}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
                    locked
                      ? 'border-gray-200 bg-gray-50 text-gray-400'
                      : checked
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    disabled ? 'cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleRule(rule)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{getRuleLabel(rule)}</div>
                    <div className={locked ? 'mt-1 text-xs text-gray-400' : 'mt-1 text-xs text-gray-500'}>
                      {locked ? '🔒 ' : ''}
                      {getRestrictionSummary(rule.restrictions)}
                    </div>
                  </div>
                </label>
              )
            })}

            {rules.length === 0 && (
              <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                有効なルールがありません。
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 text-blue-600 hover:text-blue-700"
            onClick={onClose}
          >
            {closeLabel}
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
