import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

type ManualLocationDialogProps = {
  open: boolean
  onClose: () => void
  onSave: (name: string, lat: number, lng: number, radius: number) => void | Promise<void>
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setLatitude('')
    setLongitude('')
    setRadius('100')
    setIsSubmitting(false)
    setSubmitError(null)
  }, [open])

  const latValue = Number(latitude)
  const lngValue = Number(longitude)
  const radiusValue = Number(radius)
  const isLatitudeOutOfRange = Number.isFinite(latValue) && (latValue < -90 || latValue > 90)
  const isLongitudeOutOfRange = Number.isFinite(lngValue) && (lngValue < -180 || lngValue > 180)
  const isValid =
    name.trim().length > 0 &&
    Number.isFinite(latValue) &&
    !isLatitudeOutOfRange &&
    Number.isFinite(lngValue) &&
    !isLongitudeOutOfRange &&
    Number.isFinite(radiusValue) &&
    radiusValue > 0

  async function handleSave() {
    if (!isValid) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await onSave(name.trim(), latValue, lngValue, radiusValue)
      onClose()
    } catch {
      setSubmitError('保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
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
            {isLatitudeOutOfRange ? (
              <p className="text-sm text-red-600">緯度は-90から90の範囲で入力してください。</p>
            ) : null}
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
            {isLongitudeOutOfRange ? (
              <p className="text-sm text-red-600">経度は-180から180の範囲で入力してください。</p>
            ) : null}
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

        {submitError ? (
          <p className="text-sm text-red-600">{submitError}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={!isValid || isSubmitting}
          >
            追加
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
