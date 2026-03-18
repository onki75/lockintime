import { Plus } from 'lucide-react'
import { Button } from '../../components/Button'
import { addSiteRule } from '../../lib/storage'

export function QuickActions() {
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

  return (
    <Button
      variant="primary"
      className="w-full"
      onClick={() => void handleQuickBlock()}
    >
      <Plus className="mr-1.5 h-4 w-4" /> 今のサイトをブロック
    </Button>
  )
}
