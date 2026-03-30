import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'

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
  isCurrentMonth: boolean,
  year: number,
  month: number,
  statuses: Record<string, DayStatus>,
): DayStatus {
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const status = statuses[dateKey]

  if (status !== undefined) {
    return status
  }

  return isCurrentMonth && day <= today ? 'empty' : 'future'
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
    container: 'flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3.5',
    grid: 'grid grid-cols-7 gap-0.5',
    dayLabel: 'py-0.5 text-center text-[9px] text-gray-400',
    cellHeight: 'h-8',
    cellRadius: 'rounded',
    cellGap: 'gap-px',
    dayNumber: 'text-[10px] font-medium leading-none',
    activeDayColor: 'text-gray-900',
    futureDayColor: 'text-gray-300',
    flameIcon: 'h-2.5 w-2.5',
    todayBorder: 'border-[1.5px] border-gray-900',
    showLegend: false,
    legendIcon: 'h-3 w-3',
    legendText: 'text-[10px] text-gray-400',
    legendGap: 'flex items-center justify-center gap-3',
  },
  lg: {
    container: 'flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6',
    grid: 'grid grid-cols-7 gap-1',
    dayLabel: 'py-1 text-center text-[11px] text-gray-400',
    cellHeight: 'h-11',
    cellRadius: 'rounded-lg',
    cellGap: 'gap-0.5',
    dayNumber: 'text-xs font-medium leading-none',
    activeDayColor: 'text-gray-900',
    futureDayColor: 'text-gray-300',
    flameIcon: 'h-3.5 w-3.5',
    todayBorder: 'border-2 border-gray-900',
    showLegend: true,
    legendIcon: 'h-3 w-3',
    legendText: 'text-[11px] text-gray-400',
    legendGap: 'flex items-center justify-center gap-4',
  },
}

function CellContent({ status, day, s }: { status: DayStatus; day: number; s: typeof sizeConfig.sm }) {
  const color = flameColors[status]

  if (status === 'future' || status === 'empty') {
    if (day === 0) return null
    return (
      <span className={`${s.dayNumber} font-normal ${s.futureDayColor}`}>{day}</span>
    )
  }

  return (
    <>
      <span className={`${s.dayNumber} ${s.activeDayColor}`}>{day}</span>
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
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const today = now.getDate()

  const [displayYear, setDisplayYear] = useState(currentYear)
  const [displayMonth, setDisplayMonth] = useState(currentMonth)

  const isCurrentMonth = displayYear === currentYear && displayMonth === currentMonth

  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()

  // 月の1日の曜日 (0=日, 1=月, ..., 6=土) → 月曜始まり変換
  const firstDayRaw = new Date(displayYear, displayMonth, 1).getDay()
  const firstDayOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1

  const cells: { day: number; status: DayStatus }[] = []
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ day: 0, status: 'empty' })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, status: getDayStatus(d, today, isCurrentMonth, displayYear, displayMonth, statuses) })
  }

  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push({ day: 0, status: 'empty' })
    weeks.push(week)
  }

  const monthName = `${displayMonth + 1}月 ${displayYear}`

  function goPrev() {
    if (displayMonth === 0) {
      setDisplayYear(displayYear - 1)
      setDisplayMonth(11)
    } else {
      setDisplayMonth(displayMonth - 1)
    }
  }

  function goNext() {
    if (isCurrentMonth) return
    if (displayMonth === 11) {
      setDisplayYear(displayYear + 1)
      setDisplayMonth(0)
    } else {
      setDisplayMonth(displayMonth + 1)
    }
  }

  return (
    <div className={s.container}>
      {size === 'sm' ? (
        <div className="flex items-center">
          <span className="text-xs">🔥</span>
          <span className="ml-1 text-[13px] font-bold text-gray-900">{streakDays}日連続</span>
          <span className="ml-auto text-[11px] text-gray-400">{monthName}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={goPrev} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{monthName}</span>
          <button
            type="button"
            onClick={goNext}
            className={isCurrentMonth ? 'text-gray-200' : 'text-gray-400 hover:text-gray-600'}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      <div className={s.grid}>
        {DAY_LABELS.map((d) => (
          <div key={d} className={s.dayLabel}>{d}</div>
        ))}
        {weeks.flat().map((cell, i) => {
          const isToday = isCurrentMonth && cell.day === today
          if (cell.day === 0) {
            return <div key={i} className={s.cellHeight} />
          }
          const isTodayClickable = isToday && onTodayClick
          const cellClassName = `flex flex-col ${s.cellHeight} ${s.cellGap} items-center justify-center ${s.cellRadius} ${
            isToday ? s.todayBorder : ''
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

      {s.showLegend && (
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
      )}
    </div>
  )
}
