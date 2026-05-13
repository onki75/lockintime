import { describe, expect, it } from 'vitest'
import type { DailyStats } from '../types'
import {
  getAverageDailyMinutes,
  getGoalAchievementCount,
  getScreenTimeComparison,
  getTodayScreenTime,
  getUsageLevel,
} from '../screen-time'

function makeDailyStats(
  date: string,
  durations: Record<string, number>,
): DailyStats {
  return {
    date,
    counts: {},
    durations,
    sessionCounts: {},
  }
}

describe('getTodayScreenTime', () => {
  it('returns zero minutes when daily stats are null', () => {
    expect(getTodayScreenTime(null, null)).toEqual({
      totalMinutes: 0,
      siteBreakdown: [],
      goalMinutes: null,
      goalAchieved: null,
    })
  })

  it('aggregates durations and sorts site breakdown by usage time', () => {
    expect(
      getTodayScreenTime(
        makeDailyStats('2026-03-16', {
          'youtube.com': 35,
          'x.com': 10,
          'github.com': 20,
        }),
        null,
      ),
    ).toEqual({
      totalMinutes: 65,
      siteBreakdown: [
        { domain: 'youtube.com', minutes: 35 },
        { domain: 'github.com', minutes: 20 },
        { domain: 'x.com', minutes: 10 },
      ],
      goalMinutes: null,
      goalAchieved: null,
    })
  })

  it('evaluates goal achievement when a goal is configured', () => {
    expect(
      getTodayScreenTime(
        makeDailyStats('2026-03-16', {
          'youtube.com': 25,
          'x.com': 10,
        }),
        30,
      ),
    ).toEqual({
      totalMinutes: 35,
      siteBreakdown: [
        { domain: 'youtube.com', minutes: 25 },
        { domain: 'x.com', minutes: 10 },
      ],
      goalMinutes: 30,
      goalAchieved: false,
    })
  })
})

describe('getScreenTimeComparison', () => {
  it('computes day-over-day change and week-over-week percentage change', () => {
    const today = makeDailyStats('2026-03-16', {
      'youtube.com': 30,
      'x.com': 12,
    })

    const dailyStatsHistory: Record<string, DailyStats> = {
      '2026-03-15': makeDailyStats('2026-03-15', { 'youtube.com': 21 }),
      '2026-03-14': makeDailyStats('2026-03-14', { 'youtube.com': 21 }),
      '2026-03-13': makeDailyStats('2026-03-13', { 'youtube.com': 21 }),
      '2026-03-12': makeDailyStats('2026-03-12', { 'youtube.com': 21 }),
      '2026-03-11': makeDailyStats('2026-03-11', { 'youtube.com': 21 }),
      '2026-03-10': makeDailyStats('2026-03-10', { 'youtube.com': 21 }),
      '2026-03-09': makeDailyStats('2026-03-09', { 'youtube.com': 12 }),
      '2026-03-08': makeDailyStats('2026-03-08', { 'youtube.com': 12 }),
      '2026-03-07': makeDailyStats('2026-03-07', { 'youtube.com': 12 }),
      '2026-03-06': makeDailyStats('2026-03-06', { 'youtube.com': 12 }),
      '2026-03-05': makeDailyStats('2026-03-05', { 'youtube.com': 12 }),
      '2026-03-04': makeDailyStats('2026-03-04', { 'youtube.com': 12 }),
      '2026-03-03': makeDailyStats('2026-03-03', { 'youtube.com': 12 }),
      '2026-03-02': makeDailyStats('2026-03-02', { 'youtube.com': 12 }),
    }

    expect(
      getScreenTimeComparison(today, dailyStatsHistory, 45, '2026-03-16'),
    ).toEqual({
      today: {
        totalMinutes: 42,
        siteBreakdown: [
          { domain: 'youtube.com', minutes: 30 },
          { domain: 'x.com', minutes: 12 },
        ],
        goalMinutes: 45,
        goalAchieved: true,
      },
      yesterday: {
        totalMinutes: 21,
        siteBreakdown: [{ domain: 'youtube.com', minutes: 21 }],
        goalMinutes: 45,
        goalAchieved: true,
      },
      thisWeekAverage: 24,
      lastWeekAverage: 12,
      thisMonthAverage: 8.8,
      lastMonthAverage: null,
      changeFromYesterday: 21,
      changeFromLastWeekPercent: 100,
    })
  })

  it('returns null comparison fields when historical baselines are unavailable', () => {
    expect(
      getScreenTimeComparison(null, {}, null, '2026-03-16'),
    ).toEqual({
      today: {
        totalMinutes: 0,
        siteBreakdown: [],
        goalMinutes: null,
        goalAchieved: null,
      },
      yesterday: null,
      thisWeekAverage: 0,
      lastWeekAverage: null,
      thisMonthAverage: 0,
      lastMonthAverage: null,
      changeFromYesterday: null,
      changeFromLastWeekPercent: null,
    })
  })
})

describe('getAverageDailyMinutes', () => {
  it('returns the average minutes for a fully populated date range', () => {
    expect(
      getAverageDailyMinutes(
        {
          '2026-03-10': makeDailyStats('2026-03-10', { site: 10 }),
          '2026-03-11': makeDailyStats('2026-03-11', { site: 20 }),
          '2026-03-12': makeDailyStats('2026-03-12', { site: 30 }),
          '2026-03-13': makeDailyStats('2026-03-13', { site: 40 }),
          '2026-03-14': makeDailyStats('2026-03-14', { site: 50 }),
          '2026-03-15': makeDailyStats('2026-03-15', { site: 60 }),
          '2026-03-16': makeDailyStats('2026-03-16', { site: 70 }),
        },
        '2026-03-10',
        '2026-03-16',
      ),
    ).toBe(40)
  })

  it('treats missing dates as zero-minute days', () => {
    expect(
      getAverageDailyMinutes(
        {
          '2026-03-10': makeDailyStats('2026-03-10', { site: 14 }),
          '2026-03-16': makeDailyStats('2026-03-16', { site: 21 }),
        },
        '2026-03-10',
        '2026-03-16',
      ),
    ).toBe(5)
  })

  it('returns zero when a range has no recorded data', () => {
    expect(getAverageDailyMinutes({}, '2026-03-10', '2026-03-16')).toBe(0)
  })
})

describe('getGoalAchievementCount', () => {
  it('counts achieved days across the full calendar range', () => {
    expect(
      getGoalAchievementCount(
        {
          '2026-03-10': makeDailyStats('2026-03-10', { site: 20 }),
          '2026-03-11': makeDailyStats('2026-03-11', { site: 25 }),
          '2026-03-12': makeDailyStats('2026-03-12', { site: 35 }),
          '2026-03-13': makeDailyStats('2026-03-13', { site: 15 }),
          '2026-03-14': makeDailyStats('2026-03-14', { site: 45 }),
          '2026-03-15': makeDailyStats('2026-03-15', { site: 10 }),
          '2026-03-16': makeDailyStats('2026-03-16', { site: 0 }),
        },
        30,
        '2026-03-10',
        '2026-03-16',
      ),
    ).toEqual({
      achieved: 5,
      total: 7,
    })
  })
})

describe('getUsageLevel', () => {
  it('classifies usage across each threshold', () => {
    expect(getUsageLevel(0, 100)).toBe('low')
    expect(getUsageLevel(50, 100)).toBe('moderate')
    expect(getUsageLevel(80, 100)).toBe('high')
    expect(getUsageLevel(100, 100)).toBe('high')
    expect(getUsageLevel(101, 100)).toBe('exceeded')
  })
})
