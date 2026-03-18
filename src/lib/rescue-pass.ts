import { DEFAULT_RESCUE_PASS, cloneRescuePass } from './defaults'
import type { RescuePass } from './types'

const MILESTONE_BONUSES = [
  { day: 7, bonus: 1 },
  { day: 30, bonus: 3 },
  { day: 100, bonus: 5 },
  { day: 365, bonus: 7 },
] as const

function normalizeStreakDays(currentStreakDays: number): number {
  if (!Number.isFinite(currentStreakDays) || currentStreakDays <= 0) {
    return 0
  }

  return Math.floor(currentStreakDays)
}

function ensureAvailablePass(pass: RescuePass): void {
  if (pass.available < 1) {
    throw new Error('Rescue pass is not available')
  }
}

function getPreviousEarnDay(currentStreakDays: number): number {
  let previousEarnDay = 0
  const currentTotal = calculateEarnedPasses(currentStreakDays)

  for (let day = currentStreakDays; day >= 1; day -= 1) {
    if (calculateEarnedPasses(day) === currentTotal && calculateEarnedPasses(day - 1) < currentTotal) {
      previousEarnDay = day
      break
    }
  }

  return previousEarnDay
}

function getNextEarnDay(currentStreakDays: number): number {
  const currentTotal = calculateEarnedPasses(currentStreakDays)
  let day = currentStreakDays + 1

  while (calculateEarnedPasses(day) === currentTotal) {
    day += 1
  }

  return day
}

export function calculateEarnedPasses(currentStreakDays: number): number {
  const streakDays = normalizeStreakDays(currentStreakDays)
  const regularEarned =
    streakDays <= 100
      ? Math.floor(streakDays / 7)
      : Math.floor(100 / 7) + Math.floor((streakDays - 100) / 5)
  const milestoneEarned = MILESTONE_BONUSES.reduce(
    (total, milestone) => total + (streakDays >= milestone.day ? milestone.bonus : 0),
    0,
  )

  return regularEarned + milestoneEarned
}

export function usePassForBypass(pass: RescuePass): RescuePass {
  ensureAvailablePass(pass)

  return {
    ...cloneRescuePass(pass),
    available: pass.available - 1,
    totalUsedBypass: pass.totalUsedBypass + 1,
  }
}

export function usePassForFreeze(pass: RescuePass): RescuePass {
  ensureAvailablePass(pass)

  if (pass.frozenCount >= pass.frozenMax) {
    throw new Error('Freeze slots are full')
  }

  return {
    ...cloneRescuePass(pass),
    available: pass.available - 1,
    frozenCount: pass.frozenCount + 1,
    totalUsedFreeze: pass.totalUsedFreeze + 1,
  }
}

export function usePassForFeed(pass: RescuePass): RescuePass {
  ensureAvailablePass(pass)

  return {
    ...cloneRescuePass(pass),
    available: pass.available - 1,
    totalUsedFeed: pass.totalUsedFeed + 1,
  }
}

export function consumeFreeze(pass: RescuePass): RescuePass {
  if (pass.frozenCount < 1) {
    throw new Error('Freeze is not equipped')
  }

  return {
    ...cloneRescuePass(pass),
    frozenCount: pass.frozenCount - 1,
  }
}

export function expandFrozenMax(pass: RescuePass, newMax: number): RescuePass {
  const nextMax = Number.isFinite(newMax) ? Math.floor(newMax) : pass.frozenMax
  const normalizedMax = Math.max(pass.frozenCount, pass.frozenMax, nextMax)

  return {
    ...cloneRescuePass(pass),
    frozenMax: normalizedMax,
  }
}

export function getProgressToNextPass(currentStreakDays: number): {
  earned: number
  total: number
  daysUntilNext: number
} {
  const streakDays = normalizeStreakDays(currentStreakDays)
  const previousEarnDay = getPreviousEarnDay(streakDays)
  const nextEarnDay = getNextEarnDay(streakDays)

  return {
    earned: streakDays - previousEarnDay,
    total: nextEarnDay - previousEarnDay,
    daysUntilNext: nextEarnDay - streakDays,
  }
}

export function initTrialPasses(): RescuePass {
  return {
    ...cloneRescuePass(DEFAULT_RESCUE_PASS),
    available: 2,
    totalEarned: 2,
  }
}
