import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '../../components/Button'
import type { RestrictionConfig, SiteRule } from '../../lib/types'
import type { RuleActivationState } from '../../lib/rule-activation'
import { updateSiteRule, removeRule } from '../../lib/storage'
import { RestrictionEditorList } from './RestrictionEditorList'

type SiteRuleEditorProps = {
  rule: SiteRule
  activationState: RuleActivationState
  onBack: () => void
}

function getStatusCopy(activationState: RuleActivationState): string | null {
  if (activationState === 'inactive_free_limit') {
    return 'Freeでは現在非適用です。プラン画面で有効ルールを選択してください。'
  }

  if (activationState === 'inactive_pro_lock') {
    return 'このルールにはPro限定の制限が含まれているため、Freeでは現在非適用です。'
  }

  return null
}

export function SiteRuleEditor({ rule, activationState, onBack }: SiteRuleEditorProps) {
  const [restrictions, setRestrictions] = useState<RestrictionConfig[]>(rule.restrictions)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const statusCopy = getStatusCopy(activationState)

  const hasChanges = JSON.stringify(restrictions) !== JSON.stringify(rule.restrictions)

  async function handleSave() {
    setSaving(true)
    try {
      await updateSiteRule(rule.id, { restrictions })
      onBack()
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await removeRule(rule.id)
      onBack()
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="戻る"
        >
          <ArrowLeft className="size-5" />
        </button>
        <img
          src={`https://www.google.com/s2/favicons?domain=${rule.url}&sz=32`}
          alt=""
          className="h-8 w-8 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{rule.url}</h2>
          <p className="text-sm text-gray-500">サイトルールの設定</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {activationState === 'active' ? '適用中' : '非適用'}
        </span>
      </div>

      {statusCopy ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statusCopy}
        </div>
      ) : null}

      <RestrictionEditorList restrictions={restrictions} onChange={setRestrictions} />

      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600">本当に削除しますか？</span>
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              キャンセル
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <Trash2 className="size-4" />
            このルールを削除
          </button>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>キャンセル</Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={!hasChanges || saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
