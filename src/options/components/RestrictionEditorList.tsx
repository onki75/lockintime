import { useState } from 'react'
import {
  Clock4,
  Hash,
  Hourglass,
  MapPin,
  Pause,
  Plus,
  Shield,
  Timer,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../components/Button'
import { EditTimeOfDayDialog } from '../../components/dialogs/EditTimeOfDayDialog'
import type { DaySchedule, DayOfWeek, Location, RestrictionConfig, RestrictionType } from '../../lib/types'

type RestrictionEditorListProps = {
  restrictions: RestrictionConfig[]
  locations?: Location[]
  onChange: (restrictions: RestrictionConfig[]) => void
}

type RestrictionMeta = {
  type: RestrictionType
  icon: LucideIcon
  label: string
  description: string
  classes: string
}

const RESTRICTION_META: RestrictionMeta[] = [
  { type: 'full_block', icon: Shield, label: '完全ブロック', description: 'アクセスを常時ブロック', classes: 'bg-red-50 text-red-600' },
  { type: 'time_of_day', icon: Clock4, label: '時間帯制限', description: '指定した時間帯にブロック', classes: 'bg-amber-50 text-amber-500' },
  { type: 'daily_count', icon: Hash, label: '使用回数制限', description: '1日の訪問回数を制限', classes: 'bg-purple-50 text-purple-600' },
  { type: 'daily_duration', icon: Hourglass, label: '使用時間制限', description: '1日の使用時間を制限', classes: 'bg-blue-50 text-blue-600' },
  { type: 'cooldown', icon: Pause, label: 'クールダウン', description: '訪問後に待機時間を設定', classes: 'bg-gray-100 text-gray-600' },
  { type: 'delay', icon: Timer, label: '遅延アクセス', description: 'アクセス前に待機時間を設定', classes: 'bg-orange-50 text-orange-600' },
  { type: 'location', icon: MapPin, label: '位置情報制限', description: '指定した場所でブロック', classes: 'bg-emerald-50 text-emerald-600' },
]

const dayLabels: Record<DayOfWeek, string> = {
  0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土',
}

function formatDays(days: DayOfWeek[]) {
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return '毎日'
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return '平日'
  if (sorted.length === 2 && sorted.join(',') === '0,6') return '休日'
  return sorted.map((d) => dayLabels[d]).join('・')
}

function formatTime(time: string) {
  const [h, m] = time.split(':')
  return `${Number(h)}:${m}`
}

function getDefaultConfig(type: RestrictionType): RestrictionConfig {
  switch (type) {
    case 'full_block': return { type: 'full_block' }
    case 'time_of_day': return { type: 'time_of_day', schedule: [{ days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' }] }
    case 'daily_count': return { type: 'daily_count', maxCount: 3 }
    case 'daily_duration': return { type: 'daily_duration', maxMinutes: 30 }
    case 'cooldown': return { type: 'cooldown', cooldownMinutes: 30 }
    case 'delay': return { type: 'delay', delaySeconds: 10 }
    case 'location': return { type: 'location', locationIds: [] }
  }
}

export function RestrictionEditorList({ restrictions, locations = [], onChange }: RestrictionEditorListProps) {
  const [editTimeOfDayOpen, setEditTimeOfDayOpen] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const activeTypes = new Set(restrictions.map((r) => r.type))
  const availableTypes = RESTRICTION_META.filter((m) => !activeTypes.has(m.type))

  function handleAdd(type: RestrictionType) {
    onChange([...restrictions, getDefaultConfig(type)])
    setShowAddMenu(false)
  }

  function handleRemove(type: RestrictionType) {
    onChange(restrictions.filter((r) => r.type !== type))
  }

  function handleUpdate(type: RestrictionType, updater: (config: RestrictionConfig) => RestrictionConfig) {
    onChange(restrictions.map((r) => r.type === type ? updater(r) : r))
  }

  function handleSaveSchedule(schedule: DaySchedule[]) {
    handleUpdate('time_of_day', () => ({ type: 'time_of_day', schedule }))
    setEditTimeOfDayOpen(false)
  }

  const currentSchedule = restrictions.find((r) => r.type === 'time_of_day')
  const scheduleData = currentSchedule?.type === 'time_of_day' ? currentSchedule.schedule : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">制限ルール</h3>
        {availableTypes.length > 0 && (
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> 追加
            </Button>
            {showAddMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close menu"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  {availableTypes.map((meta) => {
                    const Icon = meta.icon
                    return (
                      <button
                        key={meta.type}
                        type="button"
                        onClick={() => handleAdd(meta.type)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${meta.classes}`}>
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium">{meta.label}</p>
                          <p className="text-xs text-gray-400">{meta.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {restrictions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          制限ルールがありません。「追加」から制限を設定してください。
        </p>
      ) : (
        <div className="space-y-2">
          {restrictions.map((config) => {
            const meta = RESTRICTION_META.find((m) => m.type === config.type)
            if (!meta) return null
            const Icon = meta.icon

            return (
              <div key={config.type} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.classes}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                      <button
                        type="button"
                        onClick={() => handleRemove(config.type)}
                        className="text-gray-400 transition-colors hover:text-red-500"
                        aria-label={`${meta.label}を削除`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {config.type === 'full_block' && (
                      <p className="text-sm text-gray-500">アクセスを常時ブロックします</p>
                    )}

                    {config.type === 'time_of_day' && (
                      <div className="space-y-2">
                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          {config.schedule.length > 0 ? (
                            config.schedule.map((entry, i) => (
                              <p key={i}>
                                {formatDays(entry.days)} {formatTime(entry.startTime)}〜{formatTime(entry.endTime)}
                              </p>
                            ))
                          ) : (
                            <p className="text-gray-400">スケジュール未設定</p>
                          )}
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setEditTimeOfDayOpen(true)}>
                          スケジュールを編集
                        </Button>
                      </div>
                    )}

                    {config.type === 'daily_count' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">1日</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={config.maxCount}
                          onChange={(e) => handleUpdate('daily_count', () => ({
                            type: 'daily_count',
                            maxCount: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                          }))}
                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">回まで</span>
                      </div>
                    )}

                    {config.type === 'daily_duration' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">1日</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={config.maxMinutes}
                          onChange={(e) => handleUpdate('daily_duration', () => ({
                            type: 'daily_duration',
                            maxMinutes: Math.max(1, Number(e.target.value) || 1),
                          }))}
                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">分まで</span>
                      </div>
                    )}

                    {config.type === 'cooldown' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">訪問後</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={config.cooldownMinutes}
                          onChange={(e) => handleUpdate('cooldown', () => ({
                            type: 'cooldown',
                            cooldownMinutes: Math.max(1, Number(e.target.value) || 1),
                          }))}
                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">分間ブロック</span>
                      </div>
                    )}

                    {config.type === 'delay' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">アクセス前に</span>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={config.delaySeconds}
                          onChange={(e) => handleUpdate('delay', () => ({
                            type: 'delay',
                            delaySeconds: Math.max(1, Number(e.target.value) || 1),
                          }))}
                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">秒待機</span>
                      </div>
                    )}

                    {config.type === 'location' && (
                      <div className="space-y-2">
                        {locations.length > 0 ? (
                          locations.map((location) => {
                            const checked = config.locationIds.includes(location.id)

                            return (
                              <label
                                key={location.id}
                                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleUpdate('location', (current) => {
                                    if (current.type !== 'location') return current

                                    const locationIds = checked
                                      ? current.locationIds.filter((id) => id !== location.id)
                                      : [...current.locationIds, location.id]

                                    return { type: 'location', locationIds }
                                  })}
                                />
                                <span>{location.name}</span>
                              </label>
                            )
                          })
                        ) : (
                          <p className="text-sm text-gray-500">先に「場所の管理」で場所を登録してください。</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EditTimeOfDayDialog
        open={editTimeOfDayOpen}
        onClose={() => setEditTimeOfDayOpen(false)}
        schedule={scheduleData}
        onSave={(schedule) => void handleSaveSchedule(schedule)}
      />
    </div>
  )
}
