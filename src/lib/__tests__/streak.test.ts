import { describe, expect, it } from 'vitest'
import {
  buildCalendarStatusMap,
  calculateCurrentStreak,
  calculateLongestStreak,
  getGlobalStreakSummary,
} from '../streak'
import type { StreakRecord } from '../types'

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

describe('calculateCurrentStreak', () => {
  it('counts trailing successful days', () => {
    expect(
      calculateCurrentStreak([
        makeRecord('2026-03-14', 'success'),
        makeRecord('2026-03-15', 'success'),
        makeRecord('2026-03-16', 'success'),
      ]),
    ).toBe(3)
  })

  it('stops when the latest day is a failure', () => {
    expect(
      calculateCurrentStreak([
        makeRecord('2026-03-14', 'success'),
        makeRecord('2026-03-15', 'failure'),
      ]),
    ).toBe(0)
  })
})

describe('calculateLongestStreak', () => {
  it('finds the longest successful run', () => {
    expect(
      calculateLongestStreak([
        makeRecord('2026-03-11', 'success'),
        makeRecord('2026-03-12', 'bypass'),
        makeRecord('2026-03-13', 'failure'),
        makeRecord('2026-03-14', 'repaired'),
      ]),
    ).toBe(2)
  })
})

describe('getGlobalStreakSummary', () => {
  it('returns current and longest streaks', () => {
    expect(
      getGlobalStreakSummary({
        perRule: {},
        global: [
          makeRecord('2026-03-15', 'success'),
          makeRecord('2026-03-16', 'repaired'),
        ],
        updatedAt: 0,
      }),
    ).toEqual({
      current: 2,
      longest: 2,
      records: [
        makeRecord('2026-03-15', 'success'),
        makeRecord('2026-03-16', 'repaired'),
      ],
    })
  })
})

describe('buildCalendarStatusMap', () => {
  it('maps streak records to calendar statuses', () => {
    expect(
      buildCalendarStatusMap([
        makeRecord('2026-03-15', 'bypass'),
        makeRecord('2026-03-16', 'failure'),
        makeRecord('2026-03-17', 'repaired'),
      ]),
    ).toEqual({
      '2026-03-15': 'bypass',
      '2026-03-16': 'failure',
      '2026-03-17': 'repaired',
    })
  })
})
