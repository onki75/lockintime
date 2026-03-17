import { useEffect, useState } from 'react'
import { shouldShowOnboarding } from '../lib/onboarding'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import { getSettings } from '../lib/storage'
import type { Settings } from '../lib/types'
import { Onboarding } from './Onboarding'
import { Header } from './components/Header'
import { RuleList } from './components/RuleList'
import { DataManagement } from './components/DataManagement'

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)

  useEffect(() => {
    async function load() {
      const s = await getSettings()
      setSettings(s)
      setTrialActive(await isTrialActive())
      setTrialDays(await getTrialDaysRemaining())
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl space-y-8 p-8">
        <Header
          rules={settings.blockRules}
          isTrialActive={trialActive}
          trialDaysRemaining={trialDays}
        />
        <RuleList rules={settings.blockRules} />
        <DataManagement />
      </div>
    </div>
  )
}

export function Options() {
  const [autoShowOnboarding, setAutoShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    void shouldShowOnboarding()
      .then((value) => {
        if (active) {
          setAutoShowOnboarding(value)
        }
      })
      .catch(() => {
        if (active) {
          setAutoShowOnboarding(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const searchParams = new URLSearchParams(window.location.search)
  const forceOnboarding = searchParams.get('onboarding') === 'true'

  if (autoShowOnboarding === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eefbf3_100%)] px-6">
        <div className="rounded-3xl border border-white/70 bg-white/90 px-6 py-5 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          読み込み中...
        </div>
      </div>
    )
  }

  if (forceOnboarding || autoShowOnboarding) {
    return <Onboarding />
  }

  return <SettingsPage />
}
