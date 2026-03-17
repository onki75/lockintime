import { Trash2 } from 'lucide-react'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { RestrictionBadge } from '../RestrictionBadge'
import { Toggle } from '../Toggle'
import type { DayOfWeek, DaySchedule, RestrictionType } from '../../lib/types'

type RestrictionPopoverProps = {
  open: boolean
  onClose: () => void
  restrictionType: RestrictionType
  active: boolean
  onToggle: (nextActive: boolean) => void
  onDelete: () => void
  schedule?: DaySchedule[]
}

const restrictionLabels: Record<RestrictionType, string> = {
  full_block: '完全ブロック',
  time_of_day: '時間帯制限',
  daily_count: '使用回数制限',
  daily_duration: '使用時間制限',
  cooldown: 'クールダウン',
  delay: '遅延アクセス',
  location: '位置情報制限',
}

const dayLabels: Record<DayOfWeek, string> = {
  0: '日',
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
}

function formatTimeDisplay(time: string) {
  const [hour, minute] = time.split(':')
  return `${Number(hour)}:${minute}`
}

function formatDays(days: DayOfWeek[]) {
  const sortedDays = [...days].sort((a, b) => a - b)
  const joined = sortedDays.map((day) => dayLabels[day]).join('・')

  if (sortedDays.length === 5 && sortedDays.join(',') === '1,2,3,4,5') {
    return '平日（月〜金）'
  }

  if (sortedDays.length === 2 && sortedDays.join(',') === '0,6') {
    return '休日（土・日）'
  }

  if (sortedDays.length === 7) {
    return '毎日（月〜日）'
  }

  return joined
}

function formatScheduleLine(entry: DaySchedule) {
  return `${formatDays(entry.days)} ${formatTimeDisplay(entry.startTime)}〜${formatTimeDisplay(entry.endTime)}`
}

export function RestrictionPopover({
  open,
  onClose,
  restrictionType,
  active,
  onToggle,
  onDelete,
  schedule,
}: RestrictionPopoverProps) {
  const title = restrictionLabels[restrictionType]

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <RestrictionBadge type={restrictionType} active={active} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">
              制限内容の確認とON/OFFの切り替え
            </p>
          </div>
          <Toggle checked={active} onChange={onToggle} size="sm" />
        </div>

        {restrictionType === 'full_block' && (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
            このサイトへのアクセスを常時ブロックします
          </div>
        )}

        {restrictionType === 'time_of_day' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  スケジュール
                </p>
                <div className="space-y-1 text-sm text-gray-600">
                  {schedule && schedule.length > 0 ? (
                    schedule.map((entry, index) => (
                      <p key={`${entry.days.join('-')}-${index}`}>
                        {formatScheduleLine(entry)}
                      </p>
                    ))
                  ) : (
                    <p>スケジュールが設定されていません</p>
                  )}
                </div>
              </div>
              <Button variant="secondary" size="sm">
                編集
              </Button>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 transition-colors duration-200 hover:text-red-700"
          >
            <Trash2 className="size-4" />
            この制限を削除
          </button>
        </div>
      </div>
    </Dialog>
  )
}
