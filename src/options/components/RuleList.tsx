import { useState } from 'react'
import { Plus, FolderPlus, Shield } from 'lucide-react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import CreateGroupDialog from '../../components/dialogs/CreateGroupDialog'
import RuleLimitDialog from '../../components/dialogs/RuleLimitDialog'
import UpgradeDialog from '../../components/dialogs/UpgradeDialog'
import type { BlockRule, RestrictionConfig } from '../../lib/types'
import { addSiteRule, removeRule } from '../../lib/storage'
import { RuleRow } from './RuleRow'
import { AddSiteDialog } from './AddSiteDialog'

type RuleListProps = {
  rules: BlockRule[]
  isTrialActive: boolean
}

export function RuleList({ rules, isTrialActive }: RuleListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
  const [showRuleLimitDialog, setShowRuleLimitDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BlockRule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleOpenAddDialog() {
    if (!isTrialActive && rules.length >= 5) {
      setShowRuleLimitDialog(true)
      return
    }

    setShowAddDialog(true)
  }

  function handleUpgrade() {
    setShowRuleLimitDialog(false)
    setShowUpgradeDialog(true)
  }

  async function handleAdd(url: string, restrictions: RestrictionConfig[]) {
    await addSiteRule(url, restrictions)
  }

  async function handleDelete() {
    if (!deleteTarget || isDeleting) {
      return
    }

    setError(null)
    setIsDeleting(true)

    try {
      await removeRule(deleteTarget.id)
      setDeleteTarget(null)
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }

  function handleCreateGroupClick() {
    if (isTrialActive) {
      setShowCreateGroupDialog(true)
      return
    }

    setShowUpgradeDialog(true)
  }

  function handleRuleClick(_rule: BlockRule) {
    // TODO: navigate to rule detail/edit dialog
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">ブロックリスト</h2>
          <span className="text-sm text-gray-400">{rules.length} / 5件</span>
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
              onClick={() => handleRuleClick(rule)}
            />
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <AddSiteDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAdd}
      />
      <CreateGroupDialog
        open={showCreateGroupDialog}
        onClose={() => setShowCreateGroupDialog(false)}
      />
      <RuleLimitDialog
        open={showRuleLimitDialog}
        onClose={() => setShowRuleLimitDialog(false)}
        onUpgrade={handleUpgrade}
      />

      <UpgradeDialog
        open={showUpgradeDialog}
        onClose={() => setShowUpgradeDialog(false)}
      />

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4 p-6 text-center">
          <h3 className="text-base font-bold text-gray-900">ルールを削除しますか？</h3>
          <p className="text-sm text-gray-500">
            {deleteTarget?.type === 'site' ? deleteTarget.url : deleteTarget?.name} のブロックルールを削除します。
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              削除する
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
