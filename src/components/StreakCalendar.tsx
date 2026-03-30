import { Flame } from 'lucide-react'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

type DayStatus = 'success' | 'bypass' | 'repaired' | 'failure' | 'future' | 'empty'

type StreakCalendarProps = {
  streakDays: number
  statuses?: Record<string, DayStatus>
  size?: 'sm' | 'lg'
  onTodayClick?: () => void
}

function getDayStatus(
  day: number,
  today: number,
  year: number,
  month: number,
  statuses: Record<string, DayStatus>,
): DayStatus {
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const status = statuses[dateKey]

  if (status !== undefined) {
    return status
  }

  return day <= today ? 'empty' : 'future'
}

const flameColors: Record<DayStatus, string | null> = {
  success: '#16A34A',
  bypass: '#F59E0B',
  repaired: '#F59E0B',
  failure: '#DC2626',
  future: null,
  empty: null,
}

const sizeConfig = {
  sm: {
    container: 'space-y-2.5 rounded-xl border border-gray-200 bg-white p-3.5',
    headerFire: 'text-sm',
    headerStreak: 'ml-1 text-sm font-bold text-gray-900',
    headerMonth: 'ml-auto text-xs text-gray-400',
    grid: 'grid grid-cols-7 gap-0.5',
    dayLabel: 'py-0.5 text-center text-[10px] text-gray-400',
    cellHeight: 'h-8',
    dayNumber: 'text-[10px] leading-none',
    flameIcon: 'h-3 w-3',
    legendIcon: 'h-3 w-3',
    legendText: 'text-[10px] text-gray-500',
    legendGap: 'flex items-center justify-center gap-3',
  },
  lg: {
    container: 'space-y-3 rounded-xl border border-gray-200 bg-white p-5',
    headerFire: 'text-base',
    headerStreak: 'ml-1 text-lg font-bold text-gray-900',
    headerMonth: 'ml-auto text-sm text-gray-400',
    grid: 'grid grid-cols-7 gap-1',
    dayLabel: 'py-1 text-center text-xs text-gray-400',
    cellHeight: 'h-10',
    dayNumber: 'text-xs leading-none',
    flameIcon: 'h-3.5 w-3.5',
    legendIcon: 'h-3.5 w-3.5',
    legendText: 'text-xs text-gray-500',
    legendGap: 'flex items-center justify-center gap-4',
  },
}

function CellContent({ status, day, s }: { status: DayStatus; day: number; s: typeof sizeConfig.sm }) {
  const color = flameColors[status]

  if (status === 'future' || status === 'empty') {
    if (day === 0) return null
    return (
      <span className={`${s.dayNumber} text-gray-400`}>{day}</span>
    )
  }

  return (
    <>
      <span className={`${s.dayNumber} text-gray-600`}>{day}</span>
      {color && <Flame className={s.flameIcon} style={{ color }} />}
    </>
  )
}

export function StreakCalendar({
  streakDays,
  statuses = {},
  size = 'sm',
  onTodayClick,
}: StreakCalendarProps) {
  const s = sizeConfig[size]
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 月の1日の曜日 (0=日, 1=月, ..., 6=土) → 月曜始まり変換
  const firstDayRaw = new Date(year, month, 1).getDay()
  const firstDayOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1

  const cells: { day: number; status: DayStatus }[] = []
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ day: 0, status: 'empty' })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, status: getDayStatus(d, today, year, month, statuses) })
  }

  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push({ day: 0, status: 'empty' })
    weeks.push(week)
  }

  const monthName = `${month + 1}月 ${year}`

  return (
    <div className={s.container}>
      <div className="flex items-center">
        <span className={s.headerFire}>🔥</span>
        <span className={s.headerStreak}>{streakDays}日連続</span>
        <span className={s.headerMonth}>{monthName}</span>
      </div>

      <div className={s.grid}>
        {DAY_LABELS.map((d) => (
          <div key={d} className={s.dayLabel}>{d}</div>
        ))}
        {weeks.flat().map((cell, i) => {
          const isToday = cell.day === today
          if (cell.day === 0) {
            return <div key={i} className={s.cellHeight} />
          }
          const isTodayClickable = isToday && onTodayClick
          const cellClassName = `flex flex-col ${s.cellHeight} items-center justify-center rounded ${
            isToday ? 'ring-2 ring-gray-900' : ''
          } ${isTodayClickable ? 'cursor-pointer transition-transform duration-200 hover:scale-[1.04]' : ''}`

          if (isToday && onTodayClick) {
            return (
              <button
                key={i}
                type="button"
                onClick={onTodayClick}
                className={cellClassName}
                aria-label="今日のストリークを確認"
              >
                <CellContent status={cell.status} day={cell.day} s={s} />
              </button>
            )
          }

          return (
            <div key={i} className={cellClassName}>
              <CellContent status={cell.status} day={cell.day} s={s} />
            </div>
          )
        })}
      </div>

      <div className={s.legendGap}>
        <div className="flex items-center gap-1">
          <Flame className={s.legendIcon} style={{ color: '#16A34A' }} />
          <span className={s.legendText}>成功</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className={s.legendIcon} style={{ color: '#F59E0B' }} />
          <span className={s.legendText}>一時解除</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className={s.legendIcon} style={{ color: '#DC2626' }} />
          <span className={s.legendText}>失敗</span>
        </div>
      </div>
    </div>
  )
}
