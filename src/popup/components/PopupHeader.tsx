import { Shield } from 'lucide-react'

type PopupHeaderProps = {
  trialActive: boolean
  trialDays: number
}

export function PopupHeader({ trialActive, trialDays }: PopupHeaderProps) {
  return (
    <div className="flex items-center">
      <Shield className="h-5 w-5 text-blue-600" />
      <span className="ml-2 text-base font-semibold text-gray-900">LockInTime</span>
      {trialActive && (
        <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
          🎉 残り{trialDays}日
        </span>
      )}
    </div>
  )
}
