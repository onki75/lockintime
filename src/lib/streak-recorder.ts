import type {
  DailyStats,
  ScreenTimeGoal,
  StreakData,
  StreakDayStatus,
  StreakRecord,
} from './types'

export type CommittedDayStatus = 'success' | 'failure'

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0)
}

export function evaluateDayStatus(
  dailyStats: DailyStats | null | undefined,
  screenTimeGoal: ScreenTimeGoal,
): CommittedDayStatus | null {
  if (!dailyStats) {
    return null
  }

  const totalCounts = sumValues(dailyStats.counts)
  const totalMinutes = sumValues(dailyStats.durations)

  if (totalCounts === 0 && totalMinutes === 0) {
    return null
  }

  if (
    screenTimeGoal.enabled &&
    screenTimeGoal.dailyLimitMinutes > 0 &&
    totalMinutes >= screenTimeGoal.dailyLimitMinutes
  ) {
    return 'failure'
  }

  return 'success'
}

function buildRecord(date: string, status: StreakDayStatus): StreakRecord {
  return {
    date,
    status,
    success: status !== 'failure',
  }
}

function upsertRecord(records: StreakRecord[], next: StreakRecord): StreakRecord[] {
  const index = records.findIndex((record) => record.date === next.date)
  if (index === -1) {
    return [...records, next].sort((left, right) => left.date.localeCompare(right.date))
  }

  const copy = [...records]
  copy[index] = next
  return copy
}

export function markStreakBypass(
  streakData: StreakData,
  date: string,
  now: number = Date.now(),
): StreakData {
  const existing = streakData.global.find((record) => record.date === date)

  if (existing && (existing.status === 'failure' || existing.status === 'repaired')) {
    return streakData
  }

  return {
    ...streakData,
    global: upsertRecord(streakData.global, buildRecord(date, 'bypass')),
    updatedAt: now,
  }
}

export function commitDayStreak(
  streakData: StreakData,
  date: string,
  dailyStats: DailyStats | null | undefined,
  screenTimeGoal: ScreenTimeGoal,
  now: number = Date.now(),
): StreakData {
  const existing = streakData.global.find((record) => record.date === date)

  if (existing?.status === 'repaired') {
    return streakData
  }

  const evaluated = evaluateDayStatus(dailyStats, screenTimeGoal)

  if (evaluated === null) {
    return streakData
  }

  if (existing?.status === 'bypass' && evaluated === 'success') {
    return streakData
  }

  return {
    ...streakData,
    global: upsertRecord(streakData.global, buildRecord(date, evaluated)),
    updatedAt: now,
  }
}
