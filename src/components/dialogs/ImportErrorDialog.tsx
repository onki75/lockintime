import { CircleX } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type ImportErrorDialogProps = {
  open: boolean
  onClose: () => void
}

function ImportErrorDialog({ open, onClose }: ImportErrorDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <CircleX className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">インポートに失敗しました</h2>
          <p className="text-sm leading-6 text-gray-500">
            ファイル形式が正しくありません。LockInTimeからエクスポートしたJSONファイルを選択してください。
          </p>
        </div>

        <Button variant="primary" className="w-full" onClick={onClose}>
          OK
        </Button>
      </div>
    </Dialog>
  )
}

export { ImportErrorDialog }
export default ImportErrorDialog
