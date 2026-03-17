import { Timer } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type BypassConfirmDialogProps = {
  open: boolean
  onClose: () => void
  domain: string
  onBypass: () => void
}

export function BypassConfirmDialog({
  open,
  onClose,
  domain,
  onBypass,
}: BypassConfirmDialogProps) {
  function handleBypass() {
    onBypass()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Timer className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-gray-900">一時的にアクセスしますか？</h2>
            <p className="text-sm text-gray-500">{domain}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-gray-600">
          5分間だけブロックを解除します。5分後に自動でブロックが復帰します。
        </p>

        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-800">
          <span className="text-sm leading-none">⚠️</span>
          <span>ストリークに一時解除として記録されます</span>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            やめる
          </Button>
          <Button
            variant="primary"
            className="flex-1 bg-amber-500 hover:bg-amber-600 focus:ring-amber-200"
            onClick={handleBypass}
          >
            5分だけ解除
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
