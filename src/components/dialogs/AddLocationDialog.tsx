import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type AddLocationDialogProps = {
  open: boolean
  onClose: () => void
  latitude: number
  longitude: number
  onSave: (name: string, radius: number) => void
}

export function AddLocationDialog({
  open,
  onClose,
  latitude,
  longitude,
  onSave,
}: AddLocationDialogProps) {
  const [name, setName] = useState('')
  const [radius, setRadius] = useState('100')

  useEffect(() => {
    if (!open) return
    setName('')
    setRadius('100')
  }, [open])

  function handleSave() {
    const nextName = name.trim()
    const nextRadius = Number(radius)

    if (!nextName || !Number.isFinite(nextRadius) || nextRadius <= 0) return

    onSave(nextName, nextRadius)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">場所を追加（現在地）</h2>
          <p className="text-sm text-gray-500">現在取得した位置情報を保存します。</p>
        </div>

        <div className="rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white/80 p-2">
              <MapPin className="size-5 text-green-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-green-900">位置情報の取得に成功しました</p>
              <p className="text-sm text-green-800">
                緯度: {latitude.toFixed(6)} / 経度: {longitude.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">場所の名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 職場"
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">半径</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <span className="shrink-0 text-sm font-medium text-gray-600">メートル</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || !radius || Number(radius) <= 0}
          >
            追加
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
