import { Button } from '../Button'
import { Dialog } from '../Dialog'

type QuickAddConfirmDialogProps = {
  open: boolean
  onClose: () => void
  domain: string
  onConfirm: () => void
}

export function QuickAddConfirmDialog({
  open,
  onClose,
  domain,
  onConfirm,
}: QuickAddConfirmDialogProps) {
  function handleConfirm() {
    onConfirm()
    onClose()
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">このサイトをブロックしますか？</h2>
          <p className="text-sm text-gray-500">完全ブロックとして追加されます。</p>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
          <img
            src={faviconUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded"
          />
          <span className="truncate text-sm font-medium text-gray-900">{domain}</span>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm}>
            ブロック
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
