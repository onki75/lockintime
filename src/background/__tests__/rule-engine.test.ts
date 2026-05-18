import { describe, expect, it } from 'vitest'
import type { BlockRule, DailyStats, SessionState } from '../../lib/types'
import { evaluateRule, isBypassActive } from '../rule-engine'

function makeRule(overrides: Partial<BlockRule> = {}): BlockRule {
  return {
    id: 'rule-1',
    type: 'site',
    url: 'youtube.com',
    restrictions: [{ type: 'full_block' }],
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
    sessionCounts: {},
    ...overrides,
  }
}

describe('evaluateRule', () => {
  it('blocks on daily_count once the session count reaches the threshold', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        dailyStats: makeDailyStats({
          sessionCounts: { 'rule-1': 3 },
        }),
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_count')
    expect(result.subReason).toBe('exhausted')
  })

  it('gates daily_count with perSessionMinutes even when count is below the limit', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        dailyStats: makeDailyStats({ counts: { 'youtube.com': 0 } }),
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_count')
    expect(result.subReason).toBe('session_gate')
  })

  it('reports exhausted subReason when sessionCounts is at the limit with perSessionMinutes', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        dailyStats: makeDailyStats({ sessionCounts: { 'rule-1': 3 } }),
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_count')
    expect(result.subReason).toBe('exhausted')
  })

  it('does not block when a daily_count session is active and unexpired', () => {
    const now = new Date('2026-03-16T10:00:00')
    const sessionState: SessionState = {
      active: {
        'rule-1': {
          ruleId: 'rule-1',
          startedAt: now.getTime(),
          expiresAt: now.getTime() + 9 * 60_000,
        },
      },
    }
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        now,
        dailyStats: makeDailyStats({ counts: { 'youtube.com': 1 } }),
        sessionState,
      },
    )

    expect(result.blocked).toBe(false)
    expect(result.reason).toBeNull()
  })

  it('blocks daily_count when the session expiresAt has passed', () => {
    const now = new Date('2026-03-16T10:00:00')
    const sessionState: SessionState = {
      active: {
        'rule-1': {
          ruleId: 'rule-1',
          startedAt: now.getTime() - 600_000,
          expiresAt: now.getTime() - 1,
        },
      },
    }
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        now,
        dailyStats: makeDailyStats({ sessionCounts: { 'rule-1': 1 } }),
        sessionState,
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_count')
    expect(result.subReason).toBe('session_gate')
  })

  it('blocks daily_count when a legacy session lacks expiresAt', () => {
    const now = new Date('2026-03-16T10:00:00')
    const sessionState = {
      active: {
        'rule-1': { ruleId: 'rule-1', startedAt: now.getTime() } as never,
      },
    } as SessionState
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      {
        now,
        dailyStats: makeDailyStats({ sessionCounts: { 'rule-1': 1 } }),
        sessionState,
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_count')
  })

  it('blocks on daily_duration once the threshold is reached', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'daily_duration', maxMinutes: 30 }],
      }),
      {
        dailyStats: makeDailyStats({
          durations: { 'youtube.com': 30 },
        }),
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('daily_duration')
  })

  it('blocks during cooldown and returns the next available timestamp', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'cooldown', cooldownMinutes: 30 }],
      }),
      {
        now: new Date('2026-03-16T10:20:00'),
        cooldownState: {
          lastAccess: {
            'rule-1': new Date('2026-03-16T10:10:00').getTime(),
          },
        },
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('cooldown')
    expect(result.until).toBe(new Date('2026-03-16T10:40:00').getTime())
  })

  it('blocks when any configured location is active', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'location', locationIds: ['office'] }],
      }),
      {
        activeLocationIds: ['office'],
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('location')
  })

  it('suppresses both hard block and delay when bypass is active', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [
          { type: 'full_block' },
          { type: 'delay', delaySeconds: 10 },
        ],
      }),
      {
        now: new Date('2026-03-16T10:20:00'),
        bypassState: {
          entries: [
            {
              ruleId: 'rule-1',
              expiresAt: new Date('2026-03-16T10:25:00').getTime(),
              createdAt: new Date('2026-03-16T10:15:00').getTime(),
            },
          ],
        },
      },
    )

    expect(result.bypassed).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.delaySeconds).toBeNull()
  })

  it('reports delay without a hard block', () => {
    const result = evaluateRule(
      makeRule({
        restrictions: [{ type: 'delay', delaySeconds: 15 }],
      }),
    )

    expect(result.blocked).toBe(false)
    expect(result.reason).toBeNull()
    expect(result.delaySeconds).toBe(15)
  })
})

describe('isBypassActive', () => {
  it('returns true only while the bypass entry is unexpired', () => {
    expect(
      isBypassActive(
        'rule-1',
        {
          entries: [
            {
              ruleId: 'rule-1',
              expiresAt: 200,
              createdAt: 100,
            },
          ],
        },
        150,
      ),
    ).toBe(true)

    expect(
      isBypassActive(
        'rule-1',
        {
          entries: [
            {
              ruleId: 'rule-1',
              expiresAt: 200,
              createdAt: 100,
            },
          ],
        },
        201,
      ),
    ).toBe(false)
  })
})
