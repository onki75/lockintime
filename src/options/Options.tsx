import { useEffect, useState } from 'react'
import { StreakCalendar } from '../components/StreakCalendar'
import { TrialDowngradeDialog } from '../components/dialogs/TrialDowngradeDialog'
import { getEffectiveLicensePlan } from '../lib/license'
import { resolveEffectiveLicensePlan } from '../lib/license'
import { verifyAndCacheLicense } from '../lib/license'
import { shouldShowOnboarding } from '../lib/onboarding'
import { getSettings, getLicenseCache, getStreakData, saveSettings } from '../lib/storage'
import {
  getRuleActivationState,
  isProLockedRule,
  normalizeFreeActiveRuleIds,
  resolveRulePlanState,
} from '../lib/rule-activation'
import { buildCalendarStatusMap, getGlobalStreakSummary, type CalendarDayStatus } from '../lib/streak'
import { getStreakProgress, type StreakProgress } from '../lib/streak-milestones'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import type { BlockRule, LicensePlan, LocationState, Settings } from '../lib/types'
import { Onboarding } from './Onboarding'
import { Sidebar, type TabId } from './components/Sidebar'
import { RuleList } from './components/RuleList'
import { RuleDetailScreen } from './components/RuleDetailScreen'
import { DataManagement } from './components/DataManagement'
import { LocationSection } from './components/LocationSection'
import { LockModeSection } from './components/LockModeSection'
import { PlanAccount } from './components/PlanAccount'
import { ProLockedTab } from './components/ProLockedTab'
import { ScreenTimeSettings } from './components/ScreenTimeSettings'
import { StreakStatsCard } from './components/StreakStatsCard'
import { DisplaySettings } from './components/DisplaySettings'

const TRIAL_DOWNGRADE_DIALOG_SHOWN_KEY = 'trialDowngradeDialogShown'

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)
  const [licensePlan, setLicensePlan] = useState<LicensePlan>('free')
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const [showDowngrade, setShowDowngrade] = useState<boolean>(false)
  const [showManageFreeRules, setShowManageFreeRules] = useState(false)
  const [streakDays, setStreakDays] = useState(0)
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, CalendarDayStatus>>({})
  const [longestStreak, setLongestStreak] = useState(0)
  const [streakProgress, setStreakProgress] = useState<StreakProgress | null>(null)
  const [locationState, setLocationState] = useState<LocationState | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, streakData, nextTrialActive, nextTrialDays, nextLicensePlan] = await Promise.all([
          getSettings(),
          getStreakData(),
          isTrialActive(),
          getTrialDaysRemaining(),
          getEffectiveLicensePlan(),
        ])

        setSettings(s)
        setTrialActive(nextTrialActive)
        setTrialDays(nextTrialDays)
        let resolvedLicensePlan = nextLicensePlan

        const globalSummary = getGlobalStreakSummary(streakData)
        setStreakDays(globalSummary.current)
        setLongestStreak(globalSummary.longest)
        setCalendarStatuses(buildCalendarStatusMap(globalSummary.records))
        setStreakProgress(getStreakProgress(streakData.global))

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
              const verifiedCache = await verifyAndCacheLicense(email)
              resolvedLicensePlan = resolveEffectiveLicensePlan(verifiedCache)
            }
          } catch {
            // License verification failed silently
          }
          // Remove checkout param from URL
          params.delete('checkout')
          const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
          window.history.replaceState({}, '', cleanUrl)
        }

        setLicensePlan(resolvedLicensePlan)

        const nextRulePlan = resolveRulePlanState({
          trialActive: nextTrialActive,
          licensePlan: resolvedLicensePlan,
        })
        const freeCompatibleRuleCount = s.blockRules.filter((rule) => !isProLockedRule(rule)).length

        if (nextRulePlan === 'free' && freeCompatibleRuleCount > 5) {
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

    const changedAt = Date.now()
    const nextFreeActiveRuleIds = normalizeFreeActiveRuleIds(settings.blockRules, selectedIds)
    const hasChanges =
      JSON.stringify(nextFreeActiveRuleIds) !== JSON.stringify(settings.freeActiveRuleIds)

    const nextSettings = hasChanges
      ? {
        ...settings,
        freeActiveRuleIds: nextFreeActiveRuleIds,
        updatedAt: changedAt,
      }
      : settings

    try {
      setSettings(nextSettings)
      await saveSettings(nextSettings)
      setShowDowngrade(false)
      setShowManageFreeRules(false)
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
    const normalizedFreeActiveRuleIds = normalizeFreeActiveRuleIds(
      settings!.blockRules,
      settings!.freeActiveRuleIds,
    )
    const rulePlan = resolveRulePlanState({ trialActive, licensePlan })
    const hasProAccess = rulePlan === 'pro'

    switch (activeTab) {
      case 'rules': {
        const blockRules: BlockRule[] = settings!.blockRules
        const selectedRule = selectedRuleId
          ? blockRules.find((rule) => rule.id === selectedRuleId)
          : null

        if (selectedRule) {
          return (
            <RuleDetailScreen
              rule={selectedRule}
              activationState={getRuleActivationState(selectedRule, {
                plan: rulePlan,
                freeActiveRuleIds: normalizedFreeActiveRuleIds,
              })}
              onBack={() => setSelectedRuleId(null)}
            />
          )
        }

        return (
          <div className="space-y-6">
            <StreakStatsCard streakDays={streakDays} longestStreak={longestStreak} progress={streakProgress} />
            <StreakCalendar streakDays={streakDays} statuses={calendarStatuses} size="lg" />
            <RuleList
              rules={settings!.blockRules}
              plan={rulePlan}
              freeActiveRuleIds={normalizedFreeActiveRuleIds}
              onSelectRule={setSelectedRuleId}
            />
          </div>
        )
      }
      case 'lock':
        return hasProAccess
          ? <LockModeSection lockMode={settings!.lockMode} />
          : <ProLockedTab title="ロックモード" description="パスワードやチャレンジでルールの変更を保護します。衝動的な解除を防ぎます。" />
      case 'screen-time':
        return <ScreenTimeSettings settings={settings!} />
      case 'locations':
        return hasProAccess
          ? <LocationSection locations={settings!.locations} locationState={locationState} />
          : <ProLockedTab title="場所の管理" description="特定の場所にいる間だけサイトをブロックします。職場や学校を登録できます。" />
      case 'display':
        return hasProAccess
          ? <DisplaySettings settings={settings!} />
          : <ProLockedTab title="表示設定" description="ストリークの表示形式やモチベーション名言をカスタマイズします。" />
      case 'data':
        return <DataManagement />
      case 'plan':
        return (
          <PlanAccount
            rules={settings!.blockRules}
            plan={rulePlan}
            freeActiveRuleIds={normalizedFreeActiveRuleIds}
            isTrialActive={trialActive}
            trialDaysRemaining={trialDays}
            onManageFreeRules={() => setShowManageFreeRules(true)}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); setSelectedRuleId(null) }}
          hasProAccess={resolveRulePlanState({ trialActive, licensePlan }) === 'pro'}
        />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl">
            {renderContent()}
          </div>
        </main>
      </div>

      <TrialDowngradeDialog
        open={showDowngrade || showManageFreeRules}
        onClose={() => { setShowDowngrade(false); setShowManageFreeRules(false) }}
        rules={settings.blockRules}
        selectedRuleIds={settings.freeActiveRuleIds}
        onConfirm={(selectedIds) => void handleDowngradeConfirm(selectedIds)}
        title={showManageFreeRules ? 'Freeで有効にするルールを選択' : undefined}
        description={showManageFreeRules
          ? 'Freeプランでは最大5件まで適用できます。有効にするルールを選んでください。'
          : undefined}
        confirmLabel={showManageFreeRules ? '保存' : undefined}
        closeLabel={showManageFreeRules ? '閉じる' : undefined}
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
