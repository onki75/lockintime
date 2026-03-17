import { Download, Upload } from 'lucide-react'
import { Button } from '../../components/Button'
import { exportSettings, importSettings } from '../../lib/export'
import { resetOnboarding } from '../../lib/onboarding'

export function DataManagement() {
  async function handleExport() {
    const json = await exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lockintime-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      await importSettings(text)
    }
    input.click()
  }

  async function handleResetOnboarding() {
    await resetOnboarding()
    window.location.href = 'options.html?onboarding=true'
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">データ管理</h2>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> エクスポート
        </Button>
        <Button variant="secondary" size="sm" onClick={handleImport}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> インポート
        </Button>
      </div>
      <button
        type="button"
        onClick={() => void handleResetOnboarding()}
        className="text-sm text-blue-600 underline hover:text-blue-700"
      >
        セットアップを再実行
      </button>
    </div>
  )
}
