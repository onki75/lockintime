import { Plus, Settings } from 'lucide-react'
import { Button } from '../../components/Button'
import { addSiteRule } from '../../lib/storage'

type QuickActionsProps = {
  ruleCount: number
}

export function QuickActions({ ruleCount }: QuickActionsProps) {
  async function handleQuickBlock() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const url = new URL(tab.url)
        const domain = url.hostname.replace(/^www\./, '')
        await addSiteRule(domain, [{ type: 'full_block' }])
      }
    } catch {
      // ignore errors (e.g. chrome:// pages)
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-center text-sm font-medium text-gray-900">
        ブロック中: {ruleCount}サイト
      </div>
      <Button
        variant="primary"
        className="w-full"
        onClick={() => void handleQuickBlock()}
      >
        <Plus className="mr-1.5 h-4 w-4" /> 今のサイトをブロック
      </Button>
      <button
        type="button"
        onClick={openSettings}
        className="flex w-full items-center justify-center gap-1.5 py-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <Settings className="h-3.5 w-3.5" /> 設定を開く
      </button>
    </div>
  )
}
