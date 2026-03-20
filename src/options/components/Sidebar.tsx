import { Shield, Lock, MapPin, Palette, Database, CreditCard, Clock } from 'lucide-react'
import type { ReactNode } from 'react'

export type TabId = 'rules' | 'screen-time' | 'lock' | 'locations' | 'display' | 'data' | 'account'

type TabDef = {
  id: TabId
  label: string
  icon: ReactNode
  group: string
  locked?: boolean
}

const TABS: TabDef[] = [
  { id: 'rules', label: 'ブロックリスト', icon: <Shield className="h-4 w-4" />, group: 'メイン' },
  { id: 'screen-time', label: 'スクリーンタイム', icon: <Clock className="h-4 w-4" />, group: 'メイン' },
  { id: 'lock', label: 'ロックモード', icon: <Lock className="h-4 w-4" />, group: 'メイン', locked: true },
  { id: 'locations', label: '場所の管理', icon: <MapPin className="h-4 w-4" />, group: 'メイン', locked: true },
  { id: 'display', label: '表示設定', icon: <Palette className="h-4 w-4" />, group: '設定', locked: true },
  { id: 'data', label: 'データ管理', icon: <Database className="h-4 w-4" />, group: '設定' },
  { id: 'account', label: 'プラン・アカウント', icon: <CreditCard className="h-4 w-4" />, group: 'アカウント' },
]

type SidebarProps = {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  isTrialActive: boolean
}

export function Sidebar({ activeTab, onTabChange, isTrialActive }: SidebarProps) {
  let lastGroup = ''

  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white py-6 pr-2 pl-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Shield className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold text-gray-900">LockInTime</span>
      </div>

      {TABS.map((tab) => {
        const showGroup = tab.group !== lastGroup
        lastGroup = tab.group

        const isLocked = tab.locked && !isTrialActive
        const isActive = activeTab === tab.id

        return (
          <div key={tab.id}>
            {showGroup && (
              <p className="mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {tab.group}
              </p>
            )}
            <button
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={[
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ].join(' ')}
            >
              <span className={isActive ? 'text-blue-600' : isLocked ? 'text-gray-300' : 'text-gray-400'}>
                {tab.icon}
              </span>
              <span className="flex-1 text-left">{tab.label}</span>
              {isLocked && <span className="text-xs text-gray-300">🔒</span>}
            </button>
          </div>
        )
      })}
    </nav>
  )
}
