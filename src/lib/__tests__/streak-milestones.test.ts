import { describe, expect, it } from 'vitest'
import type { StreakRecord } from '../types'
import {
  applyEarnBack,
  checkEarnBackEligibility,
  getNewlyReachedMilestone,
  getReachedMilestones,
  getStreakProgress,
} from '../streak-milestones'

function makeRecord(
  date: string,
  status: StreakRecord['status'],
): StreakRecord {
  return {
    date,
    status,
    success: status !== 'failure',
  }
}

describe('getReachedMilestones', () => {
  it('returns rewards for all reached thresholds', () => {
    expect(getReachedMilestones(0)).toEqual([])
    expect(getReachedMilestones(6)).toEqual([])
    expect(getReachedMilestones(7)).toEqual([
      { milestone: 7, rescuePassBonus: 1, frozenMaxExpansion: null },
    ])
    expect(getReachedMilestones(30)).toEqual([
      { milestone: 7, rescuePassBonus: 1, frozenMaxExpansion: null },
      { milestone: 30, rescuePassBonus: 3, frozenMaxExpansion: null },
    ])
    expect(getReachedMilestones(99)).toEqual([
      { milestone: 7, rescuePassBonus: 1, frozenMaxExpansion: null },
      { milestone: 30, rescuePassBonus: 3, frozenMaxExpansion: null },
    ])
    expect(getReachedMilestones(100)).toEqual([
      { milestone: 7, rescuePassBonus: 1, frozenMaxExpansion: null },
      { milestone: 30, rescuePassBonus: 3, frozenMaxExpansion: null },
      { milestone: 100, rescuePassBonus: 5, frozenMaxExpansion: 3 },
    ])
    expect(getReachedMilestones(365)).toEqual([
      { milestone: 7, rescuePassBonus: 1, frozenMaxExpansion: null },
      { milestone: 30, rescuePassBonus: 3, frozenMaxExpansion: null },
      { milestone: 100, rescuePassBonus: 5, frozenMaxExpansion: 3 },
      { milestone: 365, rescuePassBonus: 7, frozenMaxExpansion: 5 },
    ])
  })
})

describe('getNewlyReachedMilestone', () => {
  it('detects the highest milestone crossed between two streak values', () => {
    expect(getNewlyReachedMilestone(6, 7)).toEqual({
      milestone: 7,
      rescuePassBonus: 1,
      frozenMaxExpansion: null,
    })
    expect(getNewlyReachedMilestone(29, 30)).toEqual({
      milestone: 30,
      rescuePassBonus: 3,
      frozenMaxExpansion: null,
    })
    expect(getNewlyReachedMilestone(6, 8)).toEqual({
      milestone: 7,
      rescuePassBonus: 1,
      frozenMaxExpansion: null,
    })
    expect(getNewlyReachedMilestone(30, 31)).toBeNull()
  })
})

describe('checkEarnBackEligibility', () => {
  it('allows earn back only when yesterday failed and today is the latest record', () => {
    expect(
      checkEarnBackEligibility([
        makeRecord('2026-03-15', 'failure'),
        makeRecord('2026-03-16', 'success'),
      ]),
    ).toEqual({
      eligible: true,
      reason: null,
    })
  })

  it('rejects two consecutive failures', () => {
    expect(
      checkEarnBackEligibility([
        makeRecord('2026-03-15', 'failure'),
        makeRecord('2026-03-16', 'failure'),
      ]),
    ).toEqual({
      eligible: false,
      reason: 'earn_back_requires_today_record',
    })
  })

  it('rejects when the previous day was not a failure', () => {
    expect(
      checkEarnBackEligibility([
        makeRecord('2026-03-15', 'success'),
        makeRecord('2026-03-16', 'success'),
      ]),
    ).toEqual({
      eligible: false,
      reason: 'previous_day_not_failure',
    })
  })
})

describe('applyEarnBack', () => {
  it('marks the target day as repaired and successful', () => {
    expect(
      applyEarnBack(
        [
          makeRecord('2026-03-14', 'success'),
          makeRecord('2026-03-15', 'failure'),
          makeRecord('2026-03-16', 'success'),
        ],
        '2026-03-15',
      ),
    ).toEqual([
      makeRecord('2026-03-14', 'success'),
      makeRecord('2026-03-15', 'repaired'),
      makeRecord('2026-03-16', 'success'),
    ])
  })
})

describe('getStreakProgress', () => {
  it('returns progress toward the next milestone', () => {
    expect(getStreakProgress([])).toEqual({
      currentStreak: 0,
      nextMilestone: 7,
      daysUntilNextMilestone: 7,
    })

    expect(
      getStreakProgress([
        makeRecord('2026-03-10', 'success'),
        makeRecord('2026-03-11', 'success'),
        makeRecord('2026-03-12', 'success'),
        makeRecord('2026-03-13', 'success'),
        makeRecord('2026-03-14', 'success'),
        makeRecord('2026-03-15', 'success'),
      ]),
    ).toEqual({
      currentStreak: 6,
      nextMilestone: 7,
      daysUntilNextMilestone: 1,
    })

    expect(
      getStreakProgress(
        Array.from({ length: 30 }, (_, index) =>
          makeRecord(`2026-03-${String(index + 1).padStart(2, '0')}`, 'success'),
        ),
      ),
    ).toEqual({
      currentStreak: 30,
      nextMilestone: 100,
      daysUntilNextMilestone: 70,
    })

    expect(
      getStreakProgress(
        Array.from({ length: 365 }, (_, index) =>
          makeRecord(`2026-${String(Math.floor(index / 30) + 1).padStart(2, '0')}-${String((index % 30) + 1).padStart(2, '0')}`, 'success'),
        ),
      ),
    ).toEqual({
      currentStreak: 365,
      nextMilestone: null,
      daysUntilNextMilestone: null,
    })
  })
})
