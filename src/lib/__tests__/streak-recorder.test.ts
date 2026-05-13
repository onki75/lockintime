import { describe, expect, it } from 'vitest'
import {
  commitDayStreak,
  evaluateDayStatus,
  markStreakBypass,
} from '../streak-recorder'
import type { DailyStats, ScreenTimeGoal, StreakData, StreakRecord } from '../types'

function makeDailyStats(overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    date: '2026-05-11',
    counts: {},
    durations: {},
    sessionCounts: {},
    ...overrides,
  }
}

function makeStreakData(records: StreakRecord[] = []): StreakData {
  return {
    perRule: {},
    global: records,
    updatedAt: 0,
  }
}

const DISABLED_GOAL: ScreenTimeGoal = { enabled: false, dailyLimitMinutes: 0 }
const ENABLED_GOAL_60: ScreenTimeGoal = { enabled: true, dailyLimitMinutes: 60 }

describe('evaluateDayStatus', () => {
  it('returns null when dailyStats is null', () => {
    expect(evaluateDayStatus(null, DISABLED_GOAL)).toBeNull()
  })

  it('returns null when dailyStats has no activity', () => {
    expect(evaluateDayStatus(makeDailyStats(), DISABLED_GOAL)).toBeNull()
  })

  it('returns success when active and screen-time goal is disabled', () => {
    const stats = makeDailyStats({ counts: { 'youtube.com': 3 } })
    expect(evaluateDayStatus(stats, DISABLED_GOAL)).toBe('success')
  })

  it('returns success when active and durations are under goal', () => {
    const stats = makeDailyStats({ durations: { 'youtube.com': 30 } })
    expect(evaluateDayStatus(stats, ENABLED_GOAL_60)).toBe('success')
  })

  it('returns failure when durations reach the goal threshold', () => {
    const stats = makeDailyStats({ durations: { 'youtube.com': 60 } })
    expect(evaluateDayStatus(stats, ENABLED_GOAL_60)).toBe('failure')
  })

  it('sums durations across multiple sites for goal comparison', () => {
    const stats = makeDailyStats({
      durations: { 'youtube.com': 30, 'x.com': 35 },
    })
    expect(evaluateDayStatus(stats, ENABLED_GOAL_60)).toBe('failure')
  })

  it('returns success when goal limit is zero', () => {
    const stats = makeDailyStats({ counts: { 'youtube.com': 1 } })
    expect(
      evaluateDayStatus(stats, { enabled: true, dailyLimitMinutes: 0 }),
    ).toBe('success')
  })
})

describe('markStreakBypass', () => {
  it('inserts a bypass record when none exists for the date', () => {
    const result = markStreakBypass(makeStreakData(), '2026-05-11', 1000)
    expect(result.global).toEqual([
      { date: '2026-05-11', status: 'bypass', success: true },
    ])
    expect(result.updatedAt).toBe(1000)
  })

  it('upgrades an existing success record to bypass', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'success', success: true },
    ])
    expect(markStreakBypass(data, '2026-05-11', 1000).global[0].status).toBe(
      'bypass',
    )
  })

  it('leaves a failure record untouched', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'failure', success: false },
    ])
    expect(markStreakBypass(data, '2026-05-11', 1000)).toBe(data)
  })

  it('leaves a repaired record untouched', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'repaired', success: true },
    ])
    expect(markStreakBypass(data, '2026-05-11', 1000)).toBe(data)
  })

  it('keeps records sorted by date after insertion', () => {
    const data = makeStreakData([
      { date: '2026-05-13', status: 'success', success: true },
    ])
    const result = markStreakBypass(data, '2026-05-11', 1000)
    expect(result.global.map((record) => record.date)).toEqual([
      '2026-05-11',
      '2026-05-13',
    ])
  })
})

describe('commitDayStreak', () => {
  it('appends a success record when the day was active', () => {
    const stats = makeDailyStats({ counts: { 'youtube.com': 1 } })
    const result = commitDayStreak(
      makeStreakData(),
      '2026-05-11',
      stats,
      DISABLED_GOAL,
      1000,
    )
    expect(result.global).toEqual([
      { date: '2026-05-11', status: 'success', success: true },
    ])
    expect(result.updatedAt).toBe(1000)
  })

  it('appends a failure record when the screen-time goal was exceeded', () => {
    const stats = makeDailyStats({ durations: { 'youtube.com': 90 } })
    const result = commitDayStreak(
      makeStreakData(),
      '2026-05-11',
      stats,
      ENABLED_GOAL_60,
      1000,
    )
    expect(result.global[0]).toEqual({
      date: '2026-05-11',
      status: 'failure',
      success: false,
    })
  })

  it('does nothing when stats are absent or empty', () => {
    const data = makeStreakData()
    expect(
      commitDayStreak(data, '2026-05-11', null, DISABLED_GOAL, 1000),
    ).toBe(data)
    expect(
      commitDayStreak(data, '2026-05-11', makeDailyStats(), DISABLED_GOAL, 1000),
    ).toBe(data)
  })

  it('preserves an existing bypass record when evaluation would be success', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'bypass', success: true },
    ])
    const stats = makeDailyStats({ durations: { 'youtube.com': 10 } })
    expect(
      commitDayStreak(data, '2026-05-11', stats, ENABLED_GOAL_60, 1000),
    ).toBe(data)
  })

  it('upgrades a bypass record to failure when the goal was exceeded', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'bypass', success: true },
    ])
    const stats = makeDailyStats({ durations: { 'youtube.com': 90 } })
    const result = commitDayStreak(data, '2026-05-11', stats, ENABLED_GOAL_60, 1000)
    expect(result.global[0].status).toBe('failure')
  })

  it('never overwrites a repaired record', () => {
    const data = makeStreakData([
      { date: '2026-05-11', status: 'repaired', success: true },
    ])
    const stats = makeDailyStats({ durations: { 'youtube.com': 90 } })
    expect(
      commitDayStreak(data, '2026-05-11', stats, ENABLED_GOAL_60, 1000),
    ).toBe(data)
  })

  it('inserts the new record while preserving date ordering', () => {
    const data = makeStreakData([
      { date: '2026-05-13', status: 'success', success: true },
    ])
    const stats = makeDailyStats({ counts: { 'youtube.com': 1 } })
    const result = commitDayStreak(data, '2026-05-11', stats, DISABLED_GOAL, 1000)
    expect(result.global.map((record) => record.date)).toEqual([
      '2026-05-11',
      '2026-05-13',
    ])
  })
})
