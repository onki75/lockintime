import { useState } from 'react'
import { Plus, FolderPlus, Shield } from 'lucide-react'
import { Button } from '../../components/Button'
import CreateGroupDialog from '../../components/dialogs/CreateGroupDialog'
import UpgradeDialog from '../../components/dialogs/UpgradeDialog'
import type { BlockRule, RestrictionConfig } from '../../lib/types'
import type { RulePlanState } from '../../lib/rule-activation'
import { getActiveRuleCount, getRuleActivationState } from '../../lib/rule-activation'
import { addSiteRule } from '../../lib/storage'
import { RuleRow } from './RuleRow'
import { AddSiteDialog } from './AddSiteDialog'

type RuleListProps = {
  rules: BlockRule[]
  plan: RulePlanState
  freeActiveRuleIds: string[]
  onSelectRule: (ruleId: string) => void
}

export function RuleList({ rules, plan, freeActiveRuleIds, onSelectRule }: RuleListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const activeRuleCount = getActiveRuleCount(rules, { plan, freeActiveRuleIds })

  function handleOpenAddDialog() {
    setShowAddDialog(true)
  }

  async function handleAdd(url: string, restrictions: RestrictionConfig[]) {
    await addSiteRule(url, restrictions)
  }

  function handleCreateGroupClick() {
    if (plan === 'pro') {
      setShowCreateGroupDialog(true)
      return
    }

    setShowUpgradeDialog(true)
  }

  function handleRuleClick(rule: BlockRule) {
    onSelectRule(rule.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">ブロックリスト</h2>
          <span className="text-sm text-gray-400">
            {plan === 'free' ? `${activeRuleCount} / 5件有効` : `${rules.length}件`}
          </span>
        </div>
        {rules.length > 0 && (
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleOpenAddDialog}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> サイトを追加
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreateGroupClick}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> グループを作成 (Pro)
            </Button>
          </div>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-10">
          <Shield className="h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-800">ブロックするサイトがありません</p>
          <p className="text-center text-sm text-gray-500">
            サイトを追加してブロックを始めましょう。
          </p>
          <div className="flex gap-3">
            <Button variant="primary" size="sm" onClick={handleOpenAddDialog}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> サイトを追加
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5 rounded-xl bg-gray-100 p-1.5">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              activationState={getRuleActivationState(rule, { plan, freeActiveRuleIds })}
              onClick={() => handleRuleClick(rule)}
            />
          ))}
        </div>
      )}

      <AddSiteDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAdd}
      />
      <CreateGroupDialog
        open={showCreateGroupDialog}
        onClose={() => setShowCreateGroupDialog(false)}
      />

      <UpgradeDialog
        open={showUpgradeDialog}
        onClose={() => setShowUpgradeDialog(false)}
      />

    </div>
  )
}
