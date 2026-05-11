import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { DomainIcon } from '../DomainIcon'

type QuickAddConfirmDialogProps = {
  open: boolean
  onClose: () => void
  domain: string
  onConfirm: () => void
  isSubmitting?: boolean
  confirmDisabled?: boolean
  statusMessage?: string | null
  statusTone?: 'warning' | 'error' | null
}

export function QuickAddConfirmDialog({
  open,
  onClose,
  domain,
  onConfirm,
  isSubmitting = false,
  confirmDisabled = false,
  statusMessage = null,
  statusTone = null,
}: QuickAddConfirmDialogProps) {
  function handleConfirm() {
    if (confirmDisabled || isSubmitting) {
      return
    }

    onConfirm()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">このサイトをブロックしますか？</h2>
          <p className="text-sm text-gray-500">完全ブロックとして追加されます。</p>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
          <DomainIcon domain={domain} size="md" />
          <span className="truncate text-sm font-medium text-gray-900">{domain}</span>
        </div>

        {statusMessage ? (
          <div
            className={[
              'rounded-lg border px-3 py-3 text-sm',
              statusTone === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            ].join(' ')}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirmDisabled || isSubmitting}
          >
            {isSubmitting ? '追加中...' : 'ブロック'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
