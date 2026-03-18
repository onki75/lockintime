import { describe, expect, it } from 'vitest'
import {
  buildCalendarStatusMap,
  calculateCurrentStreak,
  calculateLongestStreak,
  getGlobalStreakSummary,
} from '../streak'

describe('calculateCurrentStreak', () => {
  it('counts trailing successful days', () => {
    expect(
      calculateCurrentStreak([
        { date: '2026-03-14', success: true },
        { date: '2026-03-15', success: true },
        { date: '2026-03-16', success: true },
      ]),
    ).toBe(3)
  })

  it('stops when the latest day is a failure', () => {
    expect(
      calculateCurrentStreak([
        { date: '2026-03-14', success: true },
        { date: '2026-03-15', success: false },
      ]),
    ).toBe(0)
  })
})

describe('calculateLongestStreak', () => {
  it('finds the longest successful run', () => {
    expect(
      calculateLongestStreak([
        { date: '2026-03-11', success: true },
        { date: '2026-03-12', success: true },
        { date: '2026-03-13', success: false },
        { date: '2026-03-14', success: true },
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
          { date: '2026-03-15', success: true },
          { date: '2026-03-16', success: true },
        ],
        updatedAt: 0,
      }),
    ).toEqual({
      current: 2,
      longest: 2,
      records: [
        { date: '2026-03-15', success: true },
        { date: '2026-03-16', success: true },
      ],
    })
  })
})

describe('buildCalendarStatusMap', () => {
  it('maps streak records to calendar statuses', () => {
    expect(
      buildCalendarStatusMap([
        { date: '2026-03-15', success: true },
        { date: '2026-03-16', success: false },
      ]),
    ).toEqual({
      '2026-03-15': 'success',
      '2026-03-16': 'failure',
    })
  })
})
