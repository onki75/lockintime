import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../components/Button'
import { QuickAddConfirmDialog } from '../../components/dialogs/QuickAddConfirmDialog'
import { addSiteRule, checkDuplicate } from '../../lib/storage'
import type { DuplicateCheckResult } from '../../lib/storage'

export function QuickActions() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [domain, setDomain] = useState('')
  const [duplicateStatus, setDuplicateStatus] = useState<DuplicateCheckResult['status']>('ok')
  const [groupName, setGroupName] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function applyDuplicateResult(result: DuplicateCheckResult) {
    setDuplicateStatus(result.status)
    setGroupName(result.status === 'exists_in_group' ? result.groupName : null)
    setSubmitError(null)
  }

  function handleCloseDialog() {
    setDialogOpen(false)
    setDomain('')
    setDuplicateStatus('ok')
    setGroupName(null)
    setSubmitError(null)
    setIsSubmitting(false)
  }

  async function handleQuickBlock() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const url = new URL(tab.url)
        const domain = url.hostname.replace(/^www\./, '')
        const duplicate = await checkDuplicate(domain)
        setDomain(domain)
        applyDuplicateResult(duplicate)
        setDialogOpen(true)
      }
    } catch {
      // ignore errors (e.g. chrome:// pages)
    }
  }

  async function handleConfirm() {
    if (!domain || duplicateStatus === 'duplicate_site' || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await addSiteRule(domain, [{ type: 'full_block' }])
      handleCloseDialog()
    } catch (error) {
      const message = (error as Error).message
      if (message === 'このサイトは既に追加されています') {
        setDuplicateStatus('duplicate_site')
      } else {
        setSubmitError('サイトの追加に失敗しました。もう一度お試しください。')
      }
      setIsSubmitting(false)
    }
  }

  const statusMessage = submitError
    ?? (duplicateStatus === 'duplicate_site'
      ? 'このサイトは既に追加されています'
      : duplicateStatus === 'exists_in_group' && groupName
        ? `このサイトはグループ「${groupName}」に含まれています。個別ルールとして追加できます。`
        : null)

  const statusTone = submitError || duplicateStatus === 'duplicate_site' ? 'error' : statusMessage ? 'warning' : null

  return (
    <>
      <Button
        variant="primary"
        className="w-full"
        onClick={() => void handleQuickBlock()}
      >
        <Plus className="mr-1.5 h-4 w-4" /> 今のサイトをブロック
      </Button>
      <QuickAddConfirmDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        domain={domain}
        onConfirm={() => void handleConfirm()}
        isSubmitting={isSubmitting}
        confirmDisabled={duplicateStatus === 'duplicate_site'}
        statusMessage={statusMessage}
        statusTone={statusTone}
      />
    </>
  )
}
