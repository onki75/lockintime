import type { DaySchedule, DayOfWeek } from '@/lib/types'

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function previousDay(day: DayOfWeek): DayOfWeek {
  return ((day + 6) % 7) as DayOfWeek
}

export function isWithinSchedule(
  schedule: DaySchedule[],
  now: Date = new Date()
): boolean {
  const currentDay = now.getDay() as DayOfWeek
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  return schedule.some(({ days, startTime, endTime }) => {
    const startMinutes = toMinutes(startTime)
    const endMinutes = toMinutes(endTime)

    if (startMinutes <= endMinutes) {
      return (
        days.includes(currentDay) &&
        currentMinutes >= startMinutes &&
        currentMinutes < endMinutes
      )
    }

    const isLateSameDay =
      days.includes(currentDay) && currentMinutes >= startMinutes
    const isEarlyNextDay =
      days.includes(previousDay(currentDay)) && currentMinutes < endMinutes

    return isLateSameDay || isEarlyNextDay
  })
}

function resolveScheduleEnd(
  startMinutes: number,
  endMinutes: number,
  now: Date,
): number {
  const end = new Date(now)
  end.setSeconds(0, 0)
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)

  if (startMinutes > endMinutes && now.getHours() * 60 + now.getMinutes() >= startMinutes) {
    end.setDate(end.getDate() + 1)
  }

  return end.getTime()
}

export function getActiveScheduleEndTime(
  schedule: DaySchedule[],
  now: Date = new Date(),
): number | null {
  const currentDay = now.getDay() as DayOfWeek
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  let activeEnd: number | null = null

  for (const { days, startTime, endTime } of schedule) {
    const startMinutes = toMinutes(startTime)
    const endMinutes = toMinutes(endTime)

    let isActive = false
    if (startMinutes <= endMinutes) {
      isActive =
        days.includes(currentDay) &&
        currentMinutes >= startMinutes &&
        currentMinutes < endMinutes
    } else {
      const isLateSameDay =
        days.includes(currentDay) && currentMinutes >= startMinutes
      const isEarlyNextDay =
        days.includes(previousDay(currentDay)) && currentMinutes < endMinutes
      isActive = isLateSameDay || isEarlyNextDay
    }

    if (!isActive) {
      continue
    }

    const endTimestamp = resolveScheduleEnd(startMinutes, endMinutes, now)
    if (activeEnd === null || endTimestamp < activeEnd) {
      activeEnd = endTimestamp
    }
  }

  return activeEnd
}
