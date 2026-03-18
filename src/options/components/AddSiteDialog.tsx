import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { checkDuplicate } from '../../lib/storage'
import { RestrictionBadge } from '../../components/RestrictionBadge'
import type { RestrictionConfig, RestrictionType } from '../../lib/types'

type AddSiteDialogProps = {
  open: boolean
  onClose: () => void
  onAdd: (url: string, restrictions: RestrictionConfig[]) => Promise<void>
}

const MVP_TYPES: RestrictionType[] = ['full_block', 'time_of_day']
const PRO_TYPES: RestrictionType[] = ['daily_count', 'daily_duration', 'cooldown', 'delay', 'location']

export function AddSiteDialog({ open, onClose, onAdd }: AddSiteDialogProps) {
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState<Set<RestrictionType>>(new Set(['full_block']))
  const [error, setError] = useState<string | null>(null)
  const [groupWarning, setGroupWarning] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function buildRestrictions(): RestrictionConfig[] {
    const restrictions: RestrictionConfig[] = []
    for (const type of selected) {
      if (type === 'full_block') restrictions.push({ type: 'full_block' })
      if (type === 'time_of_day') {
        restrictions.push({
          type: 'time_of_day',
          schedule: [{ days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' }],
        })
      }
    }
    return restrictions
  }

  function resetForm() {
    setUrl('')
    setSelected(new Set(['full_block']))
    setError(null)
    setGroupWarning(null)
    setIsSubmitting(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function toggleType(type: RestrictionType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  async function submitRule() {
    setIsSubmitting(true)
    setError(null)
    try {
      await onAdd(url.trim(), buildRestrictions())
      handleClose()
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!url.trim() || selected.size === 0) return

    setError(null)
    setGroupWarning(null)
    let duplicate: Awaited<ReturnType<typeof checkDuplicate>>
    try {
      duplicate = await checkDuplicate(url.trim())
    } catch {
      setError('URLの確認に失敗しました。もう一度お試しください。')
      return
    }
    if (duplicate.status === 'duplicate_site') {
      setError('このサイトは既に追加されています')
      return
    }
    if (duplicate.status === 'exists_in_group') {
      setGroupWarning(duplicate.groupName)
      return
    }

    await submitRule()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5 p-6">
        <h2 className="text-lg font-bold text-gray-900">サイトを追加</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">ドメイン</label>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
              setGroupWarning(null)
            }}
            placeholder="例: youtube.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          {groupWarning ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p>
                このサイトはグループ「{groupWarning}」に含まれています。個別ルールとして追加しますか？
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                onClick={() => void submitRule()}
                disabled={isSubmitting}
              >
                個別ルールとして追加
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">制限タイプ（複数選択可）</label>
          <div className="space-y-1.5">
            {MVP_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                  selected.has(type)
                    ? 'border-blue-600 bg-blue-50 font-medium text-gray-900'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded ${
                  selected.has(type) ? 'bg-blue-600' : 'border-2 border-gray-300'
                }`}>
                  {selected.has(type) && <span className="text-xs font-bold text-white">✓</span>}
                </div>
                <RestrictionBadge type={type} active={true} />
                <span>{type === 'full_block' ? '完全ブロック' : '使用時刻制限'}</span>
              </button>
            ))}

            <p className="pt-1 text-xs font-medium text-gray-400">Pro機能</p>
            {PRO_TYPES.map((type) => (
              <div
                key={type}
                className="flex w-full items-center gap-2.5 rounded-md bg-gray-50 px-3 py-2.5 text-sm text-gray-400 opacity-50"
              >
                <span>🔒</span>
                <RestrictionBadge type={type} active={false} />
                <span>
                  {type === 'daily_count' && '使用回数制限'}
                  {type === 'daily_duration' && '使用時間制限'}
                  {type === 'cooldown' && 'クールダウン'}
                  {type === 'delay' && '遅延アクセス'}
                  {type === 'location' && '位置情報制限'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>キャンセル</Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!url.trim() || selected.size === 0 || isSubmitting}
          >
            {isSubmitting ? '追加中...' : '追加'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
