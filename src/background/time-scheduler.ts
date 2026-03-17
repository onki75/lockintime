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
