import { useEffect, useState } from 'react'
import { StreakCalendar } from '../components/StreakCalendar'
import { TrialDowngradeDialog } from '../components/dialogs/TrialDowngradeDialog'
import { verifyAndCacheLicense } from '../lib/license'
import { shouldShowOnboarding } from '../lib/onboarding'
import { getSettings, getLicenseCache, getStreakData, saveSettings } from '../lib/storage'
import { buildCalendarStatusMap, getGlobalStreakSummary, type CalendarDayStatus } from '../lib/streak'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import type { LocationState, Settings } from '../lib/types'
import { Onboarding } from './Onboarding'
import { Sidebar, type TabId } from './components/Sidebar'
import { RuleList } from './components/RuleList'
import { DataManagement } from './components/DataManagement'
import { LocationSection } from './components/LocationSection'
import { LockModeSection } from './components/LockModeSection'
import { PlanAccount } from './components/PlanAccount'
import { ProLockedTab } from './components/ProLockedTab'
import { ScreenTimeSettings } from './components/ScreenTimeSettings'
import { DisplaySettings } from './components/DisplaySettings'

const TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY = 'trialDowngradeDialogShown'

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const [showDowngrade, setShowDowngrade] = useState<boolean>(false)
  const [streakDays, setStreakDays] = useState(0)
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, CalendarDayStatus>>({})
  const [locationState, setLocationState] = useState<LocationState | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, streakData, nextTrialActive, nextTrialDays] = await Promise.all([
          getSettings(),
          getStreakData(),
          isTrialActive(),
          getTrialDaysRemaining(),
        ])

        setSettings(s)
        setTrialActive(nextTrialActive)
        setTrialDays(nextTrialDays)

        const globalSummary = getGlobalStreakSummary(streakData)
        setStreakDays(globalSummary.current)
        setCalendarStatuses(buildCalendarStatusMap(globalSummary.records))

        try {
          const response = await chrome.runtime.sendMessage({ type: 'location:state' }) as {
            ok?: boolean
            locationState?: LocationState
          }
          if (response?.ok && response.locationState) {
            setLocationState(response.locationState)
          }
        } catch {
          // location state unavailable
        }

        // Handle checkout success: verify license with server
        const params = new URLSearchParams(window.location.search)
        if (params.get('checkout') === 'success') {
          try {
            const licenseCache = await getLicenseCache()
            const email = licenseCache.email
            if (email) {
              await verifyAndCacheLicense(email)
            }
          } catch {
            // License verification failed silently
          }
          // Remove checkout param from URL
          params.delete('checkout')
          const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
          window.history.replaceState({}, '', cleanUrl)
        }

        if (nextTrialActive === false && s.blockRules.length > 5) {
          const result = (await chrome.storage.local.get(TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY)) as {
            [TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY]?: boolean
          }

          if (!result[TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY]) {
            await chrome.storage.local.set({ [TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY]: true })
            setShowDowngrade(true)
          }
        }
      } catch (error) {
        console.error(error)
      }
    }
    void load()

    const onChange = () => void load()
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  async function handleDowngradeConfirm(selectedIds: string[]) {
    if (!settings) {
      return
    }

    const selectedIdSet = new Set(selectedIds)
    const changedAt = Date.now()
    let hasChanges = false

    const nextBlockRules = settings.blockRules.map((rule) => {
      const enabled = selectedIdSet.has(rule.id)

      if (rule.enabled === enabled) {
        return rule
      }

      hasChanges = true
      return {
        ...rule,
        enabled,
        updatedAt: changedAt,
      }
    })

    const nextSettings = hasChanges
      ? {
        ...settings,
        blockRules: nextBlockRules,
        updatedAt: changedAt,
      }
      : settings

    try {
      setSettings(nextSettings)
      await saveSettings(nextSettings)
      setShowDowngrade(false)
    } catch (error) {
      console.error(error)
    }
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    )
  }

  function renderContent() {
    switch (activeTab) {
      case 'rules':
        return (
          <div className="space-y-6">
            <StreakCalendar streakDays={streakDays} statuses={calendarStatuses} size="lg" />
            <RuleList rules={settings!.blockRules} isTrialActive={trialActive} />
          </div>
        )
      case 'lock':
        return trialActive
          ? <LockModeSection lockMode={settings!.lockMode} />
          : <ProLockedTab title="ロックモード" description="パスワードやチャレンジでルールの変更を保護します。衝動的な解除を防ぎます。" />
      case 'screen-time':
        return <ScreenTimeSettings settings={settings!} />
      case 'locations':
        return trialActive
          ? <LocationSection locations={settings!.locations} locationState={locationState} />
          : <ProLockedTab title="場所の管理" description="特定の場所にいる間だけサイトをブロックします。職場や学校を登録できます。" />
      case 'display':
        return trialActive
          ? <DisplaySettings settings={settings!} />
          : <ProLockedTab title="表示設定" description="ストリークの表示形式やモチベーション名言をカスタマイズします。" />
      case 'data':
        return <DataManagement />
      case 'account':
        return <PlanAccount rules={settings!.blockRules} isTrialActive={trialActive} trialDaysRemaining={trialDays} />
      default:
        return null
    }
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isTrialActive={trialActive} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl">
            {renderContent()}
          </div>
        </main>
      </div>

      <TrialDowngradeDialog
        open={showDowngrade}
        onClose={() => setShowDowngrade(false)}
        rules={settings.blockRules}
        onConfirm={(selectedIds) => void handleDowngradeConfirm(selectedIds)}
      />
    </>
  )
}

export function Options() {
  const [autoShowOnboarding, setAutoShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void shouldShowOnboarding()
      .then((value) => { if (active) setAutoShowOnboarding(value) })
      .catch(() => { if (active) setAutoShowOnboarding(false) })
    return () => { active = false }
  }, [])

  const searchParams = new URLSearchParams(window.location.search)
  const forceOnboarding = searchParams.get('onboarding') === 'true'

  if (autoShowOnboarding === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (forceOnboarding || autoShowOnboarding) {
    return <Onboarding />
  }

  return <SettingsPage />
}
