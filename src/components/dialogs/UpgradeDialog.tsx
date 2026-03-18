import { Crown } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type UpgradeDialogProps = {
  open: boolean
  onClose: () => void
}

const PRO_FEATURES = [
  '全7制限タイプ',
  'ルール無制限',
  'グループ・プリセット',
  'ストリーク',
] as const

export default function UpgradeDialog({ open, onClose }: UpgradeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-6 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Crown className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">Proプランにアップグレード</h2>
          <p className="text-sm leading-6 text-gray-500">
            制限の自由度を広げて、継続しやすい本格的な自己管理環境を使えます。
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 text-left">
          <div className="space-y-3">
            {PRO_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-600">
                  ✓
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xl font-bold text-blue-600">月額300円〜</p>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            あとで
          </Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>
            アップグレード
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default UpgradeDialog
