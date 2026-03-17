import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type ManualLocationDialogProps = {
  open: boolean
  onClose: () => void
  onSave: (name: string, lat: number, lng: number, radius: number) => void
}

export function ManualLocationDialog({
  open,
  onClose,
  onSave,
}: ManualLocationDialogProps) {
  const [name, setName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')

  useEffect(() => {
    if (!open) return
    setName('')
    setLatitude('')
    setLongitude('')
    setRadius('100')
  }, [open])

  const latValue = Number(latitude)
  const lngValue = Number(longitude)
  const radiusValue = Number(radius)
  const isValid =
    name.trim().length > 0 &&
    Number.isFinite(latValue) &&
    Number.isFinite(lngValue) &&
    Number.isFinite(radiusValue) &&
    radiusValue > 0

  function handleSave() {
    if (!isValid) return

    onSave(name.trim(), latValue, lngValue, radiusValue)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">場所を追加（手動入力）</h2>
          <p className="text-sm text-gray-500">座標を直接入力して場所を保存します。</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">緯度</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="例: 35.681"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">経度</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="例: 139.767"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
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
          <Button variant="primary" onClick={handleSave} disabled={!isValid}>
            追加
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
