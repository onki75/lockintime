import { CircleCheck } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type ExportSuccessDialogProps = {
  open: boolean
  onClose: () => void
}

function ExportSuccessDialog({
  open,
  onClose,
}: ExportSuccessDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex flex-col items-center space-y-4 px-6 py-8 text-center">
        <div className="rounded-full bg-green-50 p-3">
          <CircleCheck className="size-10 text-green-600" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-gray-900">
            エクスポート完了
          </h2>
          <p className="text-sm leading-6 text-gray-500">
            設定データの書き出しが完了しました。安全な場所に保管してください。
          </p>
        </div>
        <Button variant="primary" className="min-w-28" onClick={onClose}>
          OK
        </Button>
      </div>
    </Dialog>
  )
}

export { ExportSuccessDialog }
export default ExportSuccessDialog
