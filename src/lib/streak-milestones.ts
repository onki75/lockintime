import { calculateCurrentStreak } from './streak'
import type { StreakDayStatus, StreakRecord } from './types'

export const MILESTONES = [7, 30, 100, 365] as const

export type Milestone = typeof MILESTONES[number]

export interface MilestoneReward {
  milestone: Milestone
}

export interface EarnBackEligibility {
  eligible: boolean
  reason: string | null
}

export interface StreakProgress {
  currentStreak: number
  nextMilestone: Milestone | null
  daysUntilNextMilestone: number | null
}

const MILESTONE_REWARDS: Record<Milestone, MilestoneReward> = {
  7: { milestone: 7 },
  30: { milestone: 30 },
  100: { milestone: 100 },
  365: { milestone: 365 },
}

function normalizeStreakCount(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) {
    return 0
  }

  return Math.floor(streak)
}

function getRecordStatus(record: Pick<StreakRecord, 'success'> & Partial<Pick<StreakRecord, 'status'>>): StreakDayStatus {
  return record.status ?? (record.success ? 'success' : 'failure')
}

function normalizeRecords(records: StreakRecord[]): StreakRecord[] {
  return [...records].sort((left, right) => left.date.localeCompare(right.date))
}

function parseDateKey(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return Date.UTC(Number(year), Number(month) - 1, Number(day))
}

function areAdjacentDays(left: string, right: string): boolean {
  const leftTime = parseDateKey(left)
  const rightTime = parseDateKey(right)

  if (leftTime === null || rightTime === null) {
    return false
  }

  return rightTime - leftTime === 24 * 60 * 60 * 1000
}

export function getReachedMilestones(currentStreak: number): MilestoneReward[] {
  const streak = normalizeStreakCount(currentStreak)
  return MILESTONES
    .filter((milestone) => streak >= milestone)
    .map((milestone) => MILESTONE_REWARDS[milestone])
}

export function getNewlyReachedMilestone(
  previousStreak: number,
  currentStreak: number,
): MilestoneReward | null {
  const previous = normalizeStreakCount(previousStreak)
  const current = normalizeStreakCount(currentStreak)

  if (current <= previous) {
    return null
  }

  const newlyReached = MILESTONES.filter(
    (milestone) => previous < milestone && current >= milestone,
  )

  return newlyReached.length > 0
    ? MILESTONE_REWARDS[newlyReached[newlyReached.length - 1]]
    : null
}

export function checkEarnBackEligibility(records: StreakRecord[]): EarnBackEligibility {
  const normalized = normalizeRecords(records)

  if (normalized.length < 2) {
    return {
      eligible: false,
      reason: 'not_enough_records',
    }
  }

  const latest = normalized[normalized.length - 1]
  const previous = normalized[normalized.length - 2]

  if (getRecordStatus(latest) === 'failure') {
    return {
      eligible: false,
      reason: 'earn_back_requires_today_record',
    }
  }

  if (!areAdjacentDays(previous.date, latest.date)) {
    return {
      eligible: false,
      reason: 'earn_back_window_passed',
    }
  }

  if (getRecordStatus(previous) !== 'failure') {
    return {
      eligible: false,
      reason: 'previous_day_not_failure',
    }
  }

  return {
    eligible: true,
    reason: null,
  }
}

export function applyEarnBack(records: StreakRecord[], repairedDate: string): StreakRecord[] {
  return records.map((record) => {
    if (record.date !== repairedDate) {
      return { ...record }
    }

    return {
      ...record,
      success: true,
      status: 'repaired',
    }
  })
}

export function getStreakProgress(records: StreakRecord[]): StreakProgress {
  const currentStreak = calculateCurrentStreak(records)
  const nextMilestone = MILESTONES.find((milestone) => milestone > currentStreak) ?? null

  return {
    currentStreak,
    nextMilestone,
    daysUntilNextMilestone: nextMilestone === null ? null : nextMilestone - currentStreak,
  }
}
