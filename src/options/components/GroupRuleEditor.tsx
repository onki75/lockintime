import { useState } from 'react'
import { ArrowLeft, Folder, Trash2, X } from 'lucide-react'
import { Button } from '../../components/Button'
import { Toggle } from '../../components/Toggle'
import type { GroupRule, RestrictionConfig } from '../../lib/types'
import { updateGroupRule, removeRule } from '../../lib/storage'
import { RestrictionEditorList } from './RestrictionEditorList'

type GroupRuleEditorProps = {
  rule: GroupRule
  onBack: () => void
}

export function GroupRuleEditor({ rule, onBack }: GroupRuleEditorProps) {
  const [name, setName] = useState(rule.name)
  const [urls, setUrls] = useState<string[]>(rule.urls)
  const [enabled, setEnabled] = useState(rule.enabled)
  const [restrictions, setRestrictions] = useState<RestrictionConfig[]>(rule.restrictions)
  const [newUrl, setNewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const hasChanges =
    name !== rule.name ||
    enabled !== rule.enabled ||
    JSON.stringify(urls) !== JSON.stringify(rule.urls) ||
    JSON.stringify(restrictions) !== JSON.stringify(rule.restrictions)

  function handleAddUrl() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    if (urls.includes(trimmed)) return
    setUrls([...urls, trimmed])
    setNewUrl('')
  }

  function handleRemoveUrl(url: string) {
    setUrls(urls.filter((u) => u !== url))
  }

  function handleUrlKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddUrl()
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateGroupRule(rule.id, { name, urls, enabled, restrictions })
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
        <Folder className="h-8 w-8 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">グループルールの設定</h2>
          <p className="text-sm text-gray-500">{urls.length}サイト</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">グループ名</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="グループ名を入力"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">サイト一覧</h3>
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {urls.map((url) => (
              <span
                key={url}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-700"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${url}&sz=16`}
                  alt=""
                  className="h-4 w-4 rounded"
                />
                {url}
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(url)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                  aria-label={`${url}を削除`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="example.com"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <Button variant="secondary" onClick={handleAddUrl} disabled={!newUrl.trim()}>
            追加
          </Button>
        </div>
      </div>

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
            このグループを削除
          </button>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>キャンセル</Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={!hasChanges || saving || !name.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
