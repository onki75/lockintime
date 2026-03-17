import { useEffect, useState } from 'react'
import { getSettings } from '../lib/storage'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import type { Settings } from '../lib/types'
import { PopupHeader } from './components/PopupHeader'
import { StreakCalendar } from './components/StreakCalendar'
import { QuickActions } from './components/QuickActions'

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)

  useEffect(() => {
    async function load() {
      setSettings(await getSettings())
      setTrialActive(await isTrialActive())
      setTrialDays(await getTrialDaysRemaining())
    }
    void load()
  }, [])

  const ruleCount = settings?.blockRules.filter((r) => r.enabled).length ?? 0
  const streakDays = 12 // TODO: calculate from StreakData

  return (
    <div className="w-[360px] space-y-3 bg-white p-4">
      <PopupHeader trialActive={trialActive} trialDays={trialDays} />
      <StreakCalendar streakDays={streakDays} />
      <QuickActions ruleCount={ruleCount} />
    </div>
  )
}
