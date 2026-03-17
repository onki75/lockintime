import { useEffect, useState } from 'react'
import { shouldShowOnboarding } from '../lib/onboarding'
import { isTrialActive, getTrialDaysRemaining } from '../lib/trial'
import { getSettings } from '../lib/storage'
import type { Settings } from '../lib/types'
import { Onboarding } from './Onboarding'
import { Sidebar, type TabId } from './components/Sidebar'
import { RuleList } from './components/RuleList'
import { DataManagement } from './components/DataManagement'
import { PlanAccount } from './components/PlanAccount'
import { ProLockedTab } from './components/ProLockedTab'

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [trialActive, setTrialActive] = useState(false)
  const [trialDays, setTrialDays] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('rules')

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

  function renderContent() {
    switch (activeTab) {
      case 'rules':
        return <RuleList rules={settings!.blockRules} />
      case 'lock':
        return trialActive
          ? <div className="text-sm text-gray-500">ロックモード（P2で実装予定）</div>
          : <ProLockedTab title="ロックモード" description="パスワードやチャレンジでルールの変更を保護します。衝動的な解除を防ぎます。" />
      case 'locations':
        return trialActive
          ? <div className="text-sm text-gray-500">場所の管理（P2で実装予定）</div>
          : <ProLockedTab title="場所の管理" description="特定の場所にいる間だけサイトをブロックします。職場や学校を登録できます。" />
      case 'display':
        return trialActive
          ? <div className="text-sm text-gray-500">表示設定（P2で実装予定）</div>
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isTrialActive={trialActive} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          {renderContent()}
        </div>
      </main>
    </div>
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
