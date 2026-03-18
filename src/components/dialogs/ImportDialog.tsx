import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type ImportDialogProps = {
  open: boolean
  onClose: () => void
  onImport: (file: File) => void
}

function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) return
    setSelectedFile(null)
    setIsDragging(false)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [open])

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  function handleImport() {
    if (!selectedFile) return
    onImport(selectedFile)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Upload className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900">設定をインポート</h2>
            <p className="text-sm leading-6 text-gray-500">
              JSONファイルから設定を読み込みます。現在の設定は上書きされます。
            </p>
          </div>
        </div>

        <label
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-gray-50 px-5 py-10 text-center transition-colors',
            isDragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/60',
          ].join(' ')}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm">
            <FileUp className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">ファイルを選択またはドロップ</p>
            <p className="text-xs text-gray-500">対応形式: JSON</p>
          </div>
          {selectedFile && (
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
              {selectedFile.name}
            </div>
          )}
        </label>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={!selectedFile}>
            インポート
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export { ImportDialog }
export default ImportDialog
