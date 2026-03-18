import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import ExportSuccessDialog from '../../components/dialogs/ExportSuccessDialog'
import ImportDialog from '../../components/dialogs/ImportDialog'
import ImportErrorDialog from '../../components/dialogs/ImportErrorDialog'
import { Button } from '../../components/Button'
import { exportSettings, importSettings } from '../../lib/export'
import { resetOnboarding } from '../../lib/onboarding'

export function DataManagement() {
  const [isExportSuccessDialogOpen, setIsExportSuccessDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isImportErrorDialogOpen, setIsImportErrorDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleExport() {
    if (isExporting) {
      return
    }

    setError(null)
    setIsExporting(true)

    try {
      const json = await exportSettings()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lockintime-settings-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setIsExportSuccessDialogOpen(true)
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImport(file: File) {
    if (isImporting) {
      return
    }

    setError(null)
    setIsImporting(true)

    try {
      const text = await file.text()
      await importSettings(text)
      setIsImportDialogOpen(false)
    } catch (nextError) {
      setError((nextError as Error).message)
      setIsImportDialogOpen(false)
      setIsImportErrorDialogOpen(true)
    } finally {
      setIsImporting(false)
    }
  }

  async function handleResetOnboarding() {
    if (isResetting) {
      return
    }

    setError(null)
    setIsResetting(true)

    try {
      await resetOnboarding()
      window.location.href = 'options.html?onboarding=true'
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">データ管理</h2>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={() => void handleExport()} disabled={isExporting}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> エクスポート
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsImportDialogOpen(true)}
          disabled={isImporting}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" /> インポート
        </Button>
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void handleResetOnboarding()}
        disabled={isResetting}
        className="text-sm text-blue-600 underline hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-500"
      >
        セットアップを再実行
      </button>

      <ExportSuccessDialog
        open={isExportSuccessDialogOpen}
        onClose={() => setIsExportSuccessDialogOpen(false)}
      />
      <ImportDialog
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        isImporting={isImporting}
        onImport={(file) => {
          void handleImport(file)
        }}
      />
      <ImportErrorDialog
        open={isImportErrorDialogOpen}
        onClose={() => setIsImportErrorDialogOpen(false)}
      />
    </div>
  )
}
