import { useEffect, useState } from 'react'
import { StreakCalendar } from '../components/StreakCalendar'
import { shouldShowOnboarding } from '../lib/onboarding'
import { getSettings, getStreakData } from '../lib/storage'
import { buildCalendarStatusMap, getGlobalStreakSummary, type CalendarDayStatus } from '../lib/streak'
import { getStreakProgress, type StreakProgress } from '../lib/streak-milestones'
import type { BlockRule, LocationState, Settings } from '../lib/types'
import { Onboarding } from './Onboarding'
import { Sidebar, type TabId } from './components/Sidebar'
import { RuleList } from './components/RuleList'
import { RuleDetailScreen } from './components/RuleDetailScreen'
import { DataManagement } from './components/DataManagement'
import { LocationSection } from './components/LocationSection'
import { LockModeSection } from './components/LockModeSection'
import { ScreenTimeSettings } from './components/ScreenTimeSettings'
import { StreakStatsCard } from './components/StreakStatsCard'
import { DisplaySettings } from './components/DisplaySettings'

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const [streakDays, setStreakDays] = useState(0)
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, CalendarDayStatus>>({})
  const [longestStreak, setLongestStreak] = useState(0)
  const [streakProgress, setStreakProgress] = useState<StreakProgress | null>(null)
  const [locationState, setLocationState] = useState<LocationState | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, streakData] = await Promise.all([
          getSettings(),
          getStreakData(),
        ])

        setSettings(s)

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

      } catch (error) {
        console.error(error)
      }
    }
    void load()

    const onChange = () => void load()
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    )
  }

  function renderContent() {
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
              locations={settings!.locations}
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
              locations={settings!.locations}
              onSelectRule={setSelectedRuleId}
            />
          </div>
        )
      }
      case 'lock':
        return <LockModeSection lockMode={settings!.lockMode} />
      case 'screen-time':
        return <ScreenTimeSettings settings={settings!} />
      case 'locations':
        return <LocationSection locations={settings!.locations} locationState={locationState} />
      case 'display':
        return <DisplaySettings settings={settings!} />
      case 'data':
        return <DataManagement />
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
        />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl">
            {renderContent()}
          </div>
        </main>
      </div>
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
