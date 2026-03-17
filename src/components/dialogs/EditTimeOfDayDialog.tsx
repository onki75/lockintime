import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import type { DayOfWeek, DaySchedule } from '../../lib/types'

type EditTimeOfDayDialogProps = {
  open: boolean
  onClose: () => void
  schedule: DaySchedule[]
  onSave: (schedule: DaySchedule[]) => void
}

type QuickPreset = 'weekday' | 'weekend' | 'everyday' | 'custom'

const dayButtons: Array<{ value: DayOfWeek; label: string }> = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 0, label: '日' },
]

const presetDays: Record<Exclude<QuickPreset, 'custom'>, DayOfWeek[]> = {
  weekday: [1, 2, 3, 4, 5],
  weekend: [6, 0],
  everyday: [1, 2, 3, 4, 5, 6, 0],
}

const defaultScheduleEntry: DaySchedule = {
  days: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '18:00',
}

function cloneSchedule(schedule: DaySchedule[]) {
  return schedule.map((entry) => ({
    ...entry,
    days: [...entry.days],
  }))
}

function getInitialSchedule(schedule: DaySchedule[]) {
  return schedule.length > 0 ? cloneSchedule(schedule) : [defaultScheduleEntry]
}

function arraysEqual(left: DayOfWeek[], right: DayOfWeek[]) {
  if (left.length !== right.length) return false

  const sortedLeft = [...left].sort((a, b) => a - b)
  const sortedRight = [...right].sort((a, b) => a - b)
  return sortedLeft.every((value, index) => value === sortedRight[index])
}

function getQuickPreset(days: DayOfWeek[]): QuickPreset {
  if (arraysEqual(days, presetDays.weekday)) return 'weekday'
  if (arraysEqual(days, presetDays.weekend)) return 'weekend'
  if (arraysEqual(days, presetDays.everyday)) return 'everyday'
  return 'custom'
}

function formatTimeDisplay(time: string) {
  const [hour, minute] = time.split(':')
  return `${Number(hour)}:${minute}`
}

function isOvernight(entry: DaySchedule) {
  return entry.startTime > entry.endTime
}

export function EditTimeOfDayDialog({
  open,
  onClose,
  schedule,
  onSave,
}: EditTimeOfDayDialogProps) {
  const [draftSchedule, setDraftSchedule] = useState<DaySchedule[]>(
    getInitialSchedule(schedule),
  )

  useEffect(() => {
    if (open) {
      setDraftSchedule(getInitialSchedule(schedule))
    }
  }, [open, schedule])

  function updateEntry(
    index: number,
    updater: (entry: DaySchedule) => DaySchedule,
  ) {
    setDraftSchedule((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? updater(entry) : entry,
      ),
    )
  }

  function toggleDay(index: number, day: DayOfWeek) {
    updateEntry(index, (entry) => {
      const hasDay = entry.days.includes(day)
      const nextDays = hasDay
        ? entry.days.filter((value) => value !== day)
        : [...entry.days, day]

      return {
        ...entry,
        days: nextDays.sort((a, b) => a - b),
      }
    })
  }

  function applyQuickPreset(index: number, preset: QuickPreset) {
    updateEntry(index, (entry) => ({
      ...entry,
      days: preset === 'custom' ? [] : [...presetDays[preset]],
    }))
  }

  function addScheduleEntry() {
    setDraftSchedule((prev) => [...prev, { ...defaultScheduleEntry }])
  }

  function removeScheduleEntry(index: number) {
    setDraftSchedule((prev) => prev.filter((_, entryIndex) => entryIndex !== index))
  }

  function handleSave() {
    onSave(cloneSchedule(draftSchedule))
    onClose()
  }

  const hasInvalidEntry = draftSchedule.some(
    (entry) => entry.days.length === 0 || !entry.startTime || !entry.endTime,
  )

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">時間帯制限を編集</h2>
          <p className="text-sm text-gray-500">
            曜日とブロックする時間帯を設定します。
          </p>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {draftSchedule.map((entry, index) => {
            const activePreset = getQuickPreset(entry.days)

            return (
              <div
                key={`${index}-${entry.startTime}-${entry.endTime}`}
                className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    スケジュール {index + 1}
                  </p>
                  {draftSchedule.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeScheduleEntry(index)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                      削除
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400">
                    曜日
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {dayButtons.map((day) => {
                      const selected = entry.days.includes(day.value)

                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(index, day.value)}
                          className={[
                            'rounded-lg px-0 py-2 text-sm font-medium transition-colors duration-200',
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100',
                          ].join(' ')}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400">
                    クイックプリセット
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'weekday', label: '平日' },
                      { key: 'weekend', label: '休日' },
                      { key: 'everyday', label: '毎日' },
                      { key: 'custom', label: 'カスタム' },
                    ].map((preset) => {
                      const selected = activePreset === preset.key

                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() =>
                            applyQuickPreset(index, preset.key as QuickPreset)
                          }
                          className={[
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200',
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100',
                          ].join(' ')}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400">
                    時間
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(event) =>
                        updateEntry(index, (current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-400">〜</span>
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(event) =>
                        updateEntry(index, (current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {isOvernight(entry) && (
                    <p className="text-sm text-blue-700">
                      🌙 翌日の{formatTimeDisplay(entry.endTime)}までブロックされます
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addScheduleEntry}
          className="flex w-full items-center justify-center rounded-xl border border-dashed border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-50"
        >
          + スケジュールを追加
        </button>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={hasInvalidEntry}
          >
            保存
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
