import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { RestrictionBadge } from '../../components/RestrictionBadge'
import type { RestrictionConfig, RestrictionType } from '../../lib/types'

type AddSiteDialogProps = {
  open: boolean
  onClose: () => void
  onAdd: (url: string, restrictions: RestrictionConfig[]) => void
}

const MVP_TYPES: RestrictionType[] = ['full_block', 'time_of_day']
const PRO_TYPES: RestrictionType[] = ['daily_count', 'daily_duration', 'cooldown', 'delay', 'location']

export function AddSiteDialog({ open, onClose, onAdd }: AddSiteDialogProps) {
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState<Set<RestrictionType>>(new Set(['full_block']))

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

  function handleSubmit() {
    if (!url.trim() || selected.size === 0) return
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
    onAdd(url.trim(), restrictions)
    setUrl('')
    setSelected(new Set(['full_block']))
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <h2 className="text-lg font-bold text-gray-900">サイトを追加</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">ドメイン</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="例: youtube.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
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
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!url.trim() || selected.size === 0}>
            追加
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
