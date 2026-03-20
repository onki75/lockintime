import { Crown, Mail } from 'lucide-react'
import { useState } from 'react'
import { refreshLicenseCache } from '../../lib/license'
import { startCheckout, type PurchaseInterval } from '../../lib/purchase'
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
  'ストリーク・ロックモード',
] as const

const PLANS: { label: string; interval: PurchaseInterval; price: string; badge?: string }[] = [
  { label: '月額', interval: 'monthly', price: '480円/月' },
  { label: '年額', interval: 'yearly', price: '3,800円/年', badge: '33%OFF' },
  { label: '買い切り', interval: 'lifetime', price: '7,800円' },
]

export default function UpgradeDialog({ open, onClose }: UpgradeDialogProps) {
  const [email, setEmail] = useState('')
  const [selectedInterval, setSelectedInterval] = useState<PurchaseInterval>('yearly')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleCheckout() {
    if (!isValidEmail || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Save email to license cache before checkout (for verification on return)
      await refreshLicenseCache('free', Date.now(), email)
      await startCheckout('pro', selectedInterval, email)
      onClose()
    } catch {
      setError('決済ページを開けませんでした。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      setEmail('')
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5 p-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Crown className="h-7 w-7" />
          </div>
          <h2 className="mt-3 text-lg font-bold text-gray-900">Proプランにアップグレード</h2>
          <p className="mt-1 text-sm text-gray-500">
            制限の自由度を広げて、本格的な自己管理環境を。
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <div className="space-y-2.5">
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

        {/* Plan selection */}
        <div className="grid grid-cols-3 gap-2">
          {PLANS.map((plan) => (
            <button
              key={plan.interval}
              type="button"
              onClick={() => setSelectedInterval(plan.interval)}
              className={[
                'relative rounded-xl border px-3 py-2.5 text-center transition-all',
                selectedInterval === plan.interval
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200',
              ].join(' ')}
            >
              {plan.badge ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {plan.badge}
                </span>
              ) : null}
              <p className="text-xs text-gray-500">{plan.label}</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">{plan.price}</p>
            </button>
          ))}
        </div>

        {/* Email input */}
        <div className="space-y-1.5">
          <label htmlFor="upgrade-email" className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <Mail className="h-3.5 w-3.5" />
            メールアドレス
          </label>
          <input
            id="upgrade-email"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCheckout() }}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
          />
          <p className="text-[11px] text-gray-400">ライセンスの復元に使用します。</p>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleClose} disabled={isSubmitting}>
            あとで
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => void handleCheckout()}
            disabled={!isValidEmail || isSubmitting}
          >
            {isSubmitting ? '処理中...' : '決済ページへ'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
