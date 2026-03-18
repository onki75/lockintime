const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

type DayStatus = 'success' | 'bypass' | 'failure' | 'future' | 'empty'

type StreakCalendarProps = {
  streakDays: number
  statuses?: Record<string, DayStatus>
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

  return day <= today ? 'success' : 'future'
}

const statusStyles: Record<DayStatus, string> = {
  success: '',
  bypass: '',
  failure: '',
  future: 'bg-gray-100',
  empty: '',
}

const statusSvg: Record<DayStatus, string | null> = {
  success: '/images/mascot-success.svg',
  bypass: '/images/mascot-bypass.svg',
  failure: '/images/mascot-failure.svg',
  future: null,
  empty: null,
}

export function StreakCalendar({
  streakDays,
  statuses = {},
  onTodayClick,
}: StreakCalendarProps) {
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
    <div className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="flex items-center">
        <span className="text-sm">🔥</span>
        <span className="ml-1 text-sm font-bold text-gray-900">{streakDays}日連続</span>
        <span className="ml-auto text-xs text-gray-400">{monthName}</span>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-0.5 text-center text-[10px] text-gray-400">{d}</div>
        ))}
        {weeks.flat().map((cell, i) => {
          if (cell.status === 'empty') {
            return <div key={i} className="h-8" />
          }
          const isToday = cell.day === today
          const cellClassName = `flex h-8 items-center justify-center rounded ${statusStyles[cell.status]} ${
            isToday ? 'ring-2 ring-gray-900' : ''
          } ${isToday ? 'cursor-pointer transition-transform duration-200 hover:scale-[1.04]' : ''}`

          if (isToday) {
            return (
              <button
                key={i}
                type="button"
                onClick={onTodayClick}
                className={cellClassName}
                aria-label="今日のストリークを確認"
              >
                {cell.status !== 'future' && (
                  <span className="text-xs">{statusSvg[cell.status] && <img src={statusSvg[cell.status]!} alt="" className="h-7 w-7" />}</span>
                )}
              </button>
            )
          }

          return (
            <div
              key={i}
              className={cellClassName}
            >
              {cell.status !== 'future' && (
                <span className="text-xs">{statusSvg[cell.status] && <img src={statusSvg[cell.status]!} alt="" className="h-7 w-7" />}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1">
          <img src="/images/mascot-success.svg" alt="" className="h-3 w-3" />
          <span className="text-[10px] text-gray-500">成功</span>
        </div>
        <div className="flex items-center gap-1">
          <img src="/images/mascot-bypass.svg" alt="" className="h-3 w-3" />
          <span className="text-[10px] text-gray-500">一時解除</span>
        </div>
        <div className="flex items-center gap-1">
          <img src="/images/mascot-failure.svg" alt="" className="h-3 w-3" />
          <span className="text-[10px] text-gray-500">失敗</span>
        </div>
      </div>
    </div>
  )
}
