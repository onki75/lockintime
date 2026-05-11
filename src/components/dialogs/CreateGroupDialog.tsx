import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { presets } from '../../lib/presets'
import { addGroupRule } from '../../lib/storage'

type CreateGroupDialogProps = {
  open: boolean
  onClose: () => void
  onCreateGroup?: (ruleId: string) => void
}

export function CreateGroupDialog({
  open,
  onClose,
  onCreateGroup,
}: CreateGroupDialogProps) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createPresetGroup(preset: (typeof presets)[number]) {
    if (creating) {
      return
    }

    setCreating(true)
    setError(null)
    try {
      const rule = await addGroupRule(preset.name, preset.sites, [{ type: 'full_block' }], true)
      onCreateGroup?.(rule.id)
      onClose()
    } catch {
      setError('グループの作成に失敗しました。もう一度お試しください。')
    } finally {
      setCreating(false)
    }
  }

  async function createCustomGroup() {
    if (creating) {
      return
    }

    setCreating(true)
    setError(null)
    try {
      const rule = await addGroupRule('カスタムグループ', [], [{ type: 'full_block' }], false)
      onCreateGroup?.(rule.id)
      onClose()
    } catch {
      setError('グループの作成に失敗しました。もう一度お試しください。')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">
            グループを作成
          </h2>
          <p className="text-sm text-gray-500">
            よく使うカテゴリからすぐにグループを追加できます。
          </p>
        </div>

        <div className="space-y-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={creating}
              onClick={() => void createPresetGroup(preset)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50/60"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">
                  {preset.name}
                </p>
                <p className="text-xs text-gray-500">
                  {preset.sites.length}サイト
                </p>
              </div>
              <ChevronRight className="size-4 text-gray-400" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium text-gray-400">または</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={() => void createCustomGroup()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/70 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-100"
        >
          <Plus className="size-4" />
          カスタムグループを作成
        </button>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default CreateGroupDialog
