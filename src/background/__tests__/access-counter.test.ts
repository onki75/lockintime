import { describe, expect, it } from 'vitest'
import type { BlockRule, CooldownState, DailyStats } from '../../lib/types'
import {
  createDailyStatsForDate,
  getHostnameFromUrl,
  recordDurationForHostname,
  recordNavigationAccess,
} from '../access-counter'

function makeRule(overrides: Partial<BlockRule> = {}): BlockRule {
  return {
    id: 'rule-1',
    type: 'site',
    url: 'youtube.com',
    enabled: true,
    restrictions: [{ type: 'cooldown', cooldownMinutes: 30 }],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as BlockRule
}

function makeDailyStats(overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    date: '2026-03-16',
    counts: {},
    durations: {},
    ...overrides,
  }
}

const EMPTY_COOLDOWN_STATE: CooldownState = {
  lastAccess: {},
}

describe('getHostnameFromUrl', () => {
  it('normalizes www hostnames and ignores unsupported protocols', () => {
    expect(getHostnameFromUrl('https://www.youtube.com/watch?v=1')).toBe('youtube.com')
    expect(getHostnameFromUrl('chrome://extensions')).toBeNull()
  })
})

describe('recordNavigationAccess', () => {
  it('increments matched domain counts and cooldown timestamps', () => {
    const now = new Date('2026-03-16T10:30:00Z')
    const result = recordNavigationAccess(
      'https://www.youtube.com/watch?v=test',
      [makeRule()],
      makeDailyStats(),
      EMPTY_COOLDOWN_STATE,
      now,
    )

    expect(result).not.toBeNull()
    expect(result?.dailyStats.counts['youtube.com']).toBe(1)
    expect(result?.cooldownState.lastAccess['rule-1']).toBe(now.getTime())
  })

  it('resets stats when the date rolled over', () => {
    const result = recordNavigationAccess(
      'https://www.youtube.com/watch?v=test',
      [makeRule()],
      makeDailyStats({ date: '2026-03-15', counts: { 'youtube.com': 9 } }),
      EMPTY_COOLDOWN_STATE,
      new Date('2026-03-16T08:00:00'),
    )

    expect(result?.dailyStats).toEqual({
      ...createDailyStatsForDate(new Date('2026-03-16T08:00:00')),
      counts: { 'youtube.com': 1 },
    })
    expect(result?.dailyStats.counts['youtube.com']).toBe(1)
  })
})

describe('recordDurationForHostname', () => {
  it('accumulates minutes for matched domains', () => {
    const result = recordDurationForHostname(
      'youtube.com',
      [makeRule()],
      makeDailyStats({ durations: { 'youtube.com': 5 } }),
      120_000,
      new Date('2026-03-16T09:00:00'),
    )

    expect(result?.durations['youtube.com']).toBeCloseTo(7)
  })
})
