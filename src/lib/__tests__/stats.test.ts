import { describe, expect, it } from 'vitest'
import { aggregateSiteStats, getWeeklyStatsSummary } from '../stats'

describe('aggregateSiteStats', () => {
  it('aggregates visits and minutes per domain', () => {
    expect(
      aggregateSiteStats({
        '2026-03-15': {
          date: '2026-03-15',
          counts: { 'youtube.com': 2 },
          durations: { 'youtube.com': 15 },
        },
        '2026-03-16': {
          date: '2026-03-16',
          counts: { 'youtube.com': 1, 'x.com': 4 },
          durations: { 'youtube.com': 10, 'x.com': 20 },
        },
      }),
    ).toEqual([
      {
        domain: 'youtube.com',
        visits: 3,
        minutes: 25,
      },
      {
        domain: 'x.com',
        visits: 4,
        minutes: 20,
      },
    ])
  })
})

describe('getWeeklyStatsSummary', () => {
  it('summarizes the last 7 days of stats without trimming totals to the top sites', () => {
    expect(
      getWeeklyStatsSummary(
        {
          '2026-03-10': {
            date: '2026-03-10',
            counts: { 'youtube.com': 2 },
            durations: { 'youtube.com': 20 },
          },
          '2026-03-16': {
            date: '2026-03-16',
            counts: { 'x.com': 4, 'github.com': 1 },
            durations: { 'x.com': 25, 'github.com': 5 },
          },
        },
        {
          endDate: '2026-03-16',
          topSitesLimit: 1,
        },
      ),
    ).toEqual({
      totalVisits: 7,
      totalMinutes: 50,
      activeDays: 2,
      topSites: [
        {
          domain: 'x.com',
          visits: 4,
          minutes: 25,
        },
      ],
    })
  })
})
