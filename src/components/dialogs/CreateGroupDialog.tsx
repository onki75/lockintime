import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { presets } from '../../lib/presets'

type CreateGroupDialogProps = {
  open: boolean
  onClose: () => void
}

export function CreateGroupDialog({
  open,
  onClose,
}: CreateGroupDialogProps) {
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/70 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-100"
        >
          <Plus className="size-4" />
          カスタムグループを作成
        </button>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
