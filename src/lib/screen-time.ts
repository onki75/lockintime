import type { DailyStats } from './types'

export interface ScreenTimeSummary {
  totalMinutes: number
  siteBreakdown: { domain: string; minutes: number }[]
  goalMinutes: number | null
  goalAchieved: boolean | null
}

export interface ScreenTimeComparison {
  today: ScreenTimeSummary
  yesterday: ScreenTimeSummary | null
  thisWeekAverage: number
  lastWeekAverage: number | null
  thisMonthAverage: number
  lastMonthAverage: number | null
  changeFromYesterday: number | null
  changeFromLastWeekPercent: number | null
}

export type UsageLevel = 'low' | 'moderate' | 'high' | 'exceeded'

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shiftLocalDate(date: string, days: number): string {
  const next = parseLocalDate(date)
  next.setDate(next.getDate() + days)
  return formatLocalDate(next)
}

function getCalendarDayCount(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)

  if (start > end) {
    return 0
  }

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function getTotalMinutes(dailyStats: DailyStats | null | undefined): number {
  if (!dailyStats) {
    return 0
  }

  return Object.values(dailyStats.durations).reduce((total, minutes) => total + minutes, 0)
}

function hasDailyStatsInRange(
  dailyStatsHistory: Record<string, DailyStats>,
  startDate: string,
  endDate: string,
): boolean {
  return Object.keys(dailyStatsHistory).some((date) => date >= startDate && date <= endDate)
}

function withTodayStats(
  dailyStats: DailyStats | null,
  dailyStatsHistory: Record<string, DailyStats>,
  today: string,
): Record<string, DailyStats> {
  const history = { ...dailyStatsHistory }

  if (dailyStats) {
    history[today] = dailyStats
  } else {
    delete history[today]
  }

  return history
}

export function getTodayScreenTime(
  dailyStats: DailyStats | null,
  goalMinutes: number | null,
): ScreenTimeSummary {
  const siteBreakdown = dailyStats
    ? Object.entries(dailyStats.durations)
        .map(([domain, minutes]) => ({ domain, minutes }))
        .sort((left, right) => {
          if (right.minutes !== left.minutes) {
            return right.minutes - left.minutes
          }

          return left.domain.localeCompare(right.domain)
        })
    : []
  const totalMinutes = getTotalMinutes(dailyStats)

  return {
    totalMinutes,
    siteBreakdown,
    goalMinutes,
    goalAchieved: goalMinutes === null ? null : totalMinutes <= goalMinutes,
  }
}

export function getAverageDailyMinutes(
  dailyStatsHistory: Record<string, DailyStats>,
  startDate: string,
  endDate: string,
): number {
  const totalDays = getCalendarDayCount(startDate, endDate)

  if (totalDays === 0) {
    return 0
  }

  let totalMinutes = 0
  let currentDate = startDate

  while (currentDate <= endDate) {
    totalMinutes += getTotalMinutes(dailyStatsHistory[currentDate])
    currentDate = shiftLocalDate(currentDate, 1)
  }

  return totalMinutes / totalDays
}

export function getGoalAchievementCount(
  dailyStatsHistory: Record<string, DailyStats>,
  goalMinutes: number,
  startDate: string,
  endDate: string,
): { achieved: number; total: number } {
  const total = getCalendarDayCount(startDate, endDate)

  if (total === 0) {
    return { achieved: 0, total: 0 }
  }

  let achieved = 0
  let currentDate = startDate

  while (currentDate <= endDate) {
    if (getTotalMinutes(dailyStatsHistory[currentDate]) <= goalMinutes) {
      achieved += 1
    }

    currentDate = shiftLocalDate(currentDate, 1)
  }

  return { achieved, total }
}

export function getUsageLevel(currentMinutes: number, goalMinutes: number): UsageLevel {
  if (goalMinutes <= 0) {
    return currentMinutes > 0 ? 'exceeded' : 'low'
  }

  const usageRatio = currentMinutes / goalMinutes

  if (usageRatio < 0.5) {
    return 'low'
  }

  if (usageRatio < 0.8) {
    return 'moderate'
  }

  if (usageRatio <= 1) {
    return 'high'
  }

  return 'exceeded'
}

export function getScreenTimeComparison(
  dailyStats: DailyStats | null,
  dailyStatsHistory: Record<string, DailyStats>,
  goalMinutes: number | null,
  today: string,
): ScreenTimeComparison {
  const todaySummary = getTodayScreenTime(dailyStats, goalMinutes)
  const history = withTodayStats(dailyStats, dailyStatsHistory, today)
  const yesterdayDate = shiftLocalDate(today, -1)
  const thisWeekStart = shiftLocalDate(today, -6)
  const lastWeekStart = shiftLocalDate(today, -14)
  const lastWeekEnd = shiftLocalDate(today, -8)
  const thisMonthStart = shiftLocalDate(today, -29)
  const lastMonthStart = shiftLocalDate(today, -60)
  const lastMonthEnd = shiftLocalDate(today, -31)
  const yesterdayStats = dailyStatsHistory[yesterdayDate] ?? null
  const yesterdaySummary = yesterdayStats
    ? getTodayScreenTime(yesterdayStats, goalMinutes)
    : null
  const thisWeekAverage = getAverageDailyMinutes(history, thisWeekStart, today)
  const lastWeekAverage = hasDailyStatsInRange(history, lastWeekStart, lastWeekEnd)
    ? getAverageDailyMinutes(history, lastWeekStart, lastWeekEnd)
    : null

  return {
    today: todaySummary,
    yesterday: yesterdaySummary,
    thisWeekAverage,
    lastWeekAverage,
    thisMonthAverage: getAverageDailyMinutes(history, thisMonthStart, today),
    lastMonthAverage: hasDailyStatsInRange(history, lastMonthStart, lastMonthEnd)
      ? getAverageDailyMinutes(history, lastMonthStart, lastMonthEnd)
      : null,
    changeFromYesterday: yesterdaySummary
      ? todaySummary.totalMinutes - yesterdaySummary.totalMinutes
      : null,
    changeFromLastWeekPercent:
      lastWeekAverage === null || lastWeekAverage === 0
        ? null
        : ((thisWeekAverage - lastWeekAverage) / lastWeekAverage) * 100,
  }
}
