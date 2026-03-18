import { Settings, Shield } from 'lucide-react'

type PopupHeaderProps = {
  trialActive: boolean
  trialDays: number
}

export function PopupHeader({ trialActive, trialDays }: PopupHeaderProps) {
  function openSettings() {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="flex items-center">
      <Shield className="h-5 w-5 text-blue-600" />
      <span className="ml-2 text-base font-semibold text-gray-900">LockInTime</span>
      {trialActive && (
        <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
          🎉 残り{trialDays}日
        </span>
      )}
      <button
        type="button"
        onClick={openSettings}
        className={`${trialActive ? 'ml-2' : 'ml-auto'} rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600`}
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  )
}
