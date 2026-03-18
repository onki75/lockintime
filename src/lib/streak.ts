import type { StreakData, StreakDayStatus, StreakRecord } from './types'

export type CalendarDayStatus = StreakDayStatus | 'future' | 'empty'

function getRecordStatus(record: Pick<StreakRecord, 'success'> & Partial<Pick<StreakRecord, 'status'>>): StreakDayStatus {
  return record.status ?? (record.success ? 'success' : 'failure')
}

function normalizeRecords(records: StreakRecord[]): StreakRecord[] {
  return [...records].sort((left, right) => left.date.localeCompare(right.date))
}

export function calculateCurrentStreak(records: StreakRecord[]): number {
  const normalized = normalizeRecords(records)
  let streak = 0

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (!normalized[index].success) {
      break
    }

    streak += 1
  }

  return streak
}

export function calculateLongestStreak(records: StreakRecord[]): number {
  const normalized = normalizeRecords(records)
  let best = 0
  let current = 0

  for (const record of normalized) {
    if (record.success) {
      current += 1
      best = Math.max(best, current)
      continue
    }

    current = 0
  }

  return best
}

export function getGlobalStreakSummary(streakData: StreakData) {
  return {
    current: calculateCurrentStreak(streakData.global),
    longest: calculateLongestStreak(streakData.global),
    records: normalizeRecords(streakData.global),
  }
}

export function getRuleStreakSummary(streakData: StreakData, ruleId: string) {
  const records = normalizeRecords(streakData.perRule[ruleId] ?? [])
  return {
    current: calculateCurrentStreak(records),
    longest: calculateLongestStreak(records),
    records,
  }
}

export function buildCalendarStatusMap(records: StreakRecord[]): Record<string, CalendarDayStatus> {
  return Object.fromEntries(records.map((record) => [record.date, getRecordStatus(record)]))
}
