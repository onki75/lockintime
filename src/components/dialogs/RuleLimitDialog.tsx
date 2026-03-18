import { Lock } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type RuleLimitDialogProps = {
  open: boolean
  onClose: () => void
  onUpgrade: () => void
}

export default function RuleLimitDialog({ open, onClose, onUpgrade }: RuleLimitDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Lock className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">ルール上限に達しました</h2>
          <p className="text-sm leading-6 text-gray-500">無料プランでは5件まで設定できます。</p>
          <p className="text-lg font-bold text-red-600">5/5件</p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            閉じる
          </Button>
          <Button variant="primary" className="flex-1" onClick={onUpgrade}>
            Proを見る
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
