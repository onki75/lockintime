import { describe, expect, it, vi } from 'vitest'
import type { DailyChallenge } from '../types'
import {
  generateDailyChallenges,
  getChallengeSummary,
  shouldResetChallenges,
  updateChallengeProgress,
} from '../daily-challenge'

describe('generateDailyChallenges', () => {
  it('returns a single bronze challenge for the free plan', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(
      '00000000-0000-4000-8000-000000000001',
    )

    expect(generateDailyChallenges('2026-03-19', 'free', ['full_block'])).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        date: '2026-03-19',
        tier: 'bronze',
        type: 'no_bypass',
        description: '今日はブロックの一時解除を1回もしない',
        target: 1,
        current: 0,
        completed: false,
        completedAt: null,
      },
    ])
  })

  it('returns bronze, silver, and gold challenges for the pro plan', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000011')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000012')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000013')

    expect(
      generateDailyChallenges('2026-03-19', 'pro', ['full_block', 'daily_duration']),
    ).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000011',
        date: '2026-03-19',
        tier: 'bronze',
        type: 'no_bypass',
        description: '今日はブロックの一時解除を1回もしない',
        target: 1,
        current: 0,
        completed: false,
        completedAt: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000012',
        date: '2026-03-19',
        tier: 'silver',
        type: 'under_half_limit',
        description: '今日は使用時間を上限の50%以内に抑える',
        target: 50,
        current: 0,
        completed: false,
        completedAt: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000013',
        date: '2026-03-19',
        tier: 'gold',
        type: 'all_rules_kept',
        description: '今日は全ルールを24時間守りきる',
        target: 1,
        current: 0,
        completed: false,
        completedAt: null,
      },
    ])
  })
})

describe('updateChallengeProgress', () => {
  const now = Date.UTC(2026, 2, 19, 12, 0, 0)

  it('completes the bronze no_bypass challenge when bypass count stays at zero', () => {
    const challenges: DailyChallenge[] = [
      {
        id: 'bronze-id',
        date: '2026-03-19',
        tier: 'bronze',
        type: 'no_bypass',
        description: '今日はブロックの一時解除を1回もしない',
        target: 1,
        current: 0,
        completed: false,
        completedAt: null,
      },
    ]

    expect(
      updateChallengeProgress(
        challenges,
        {
          bypassCount: 0,
          accessFreeHours: 0,
          allRulesKept: false,
          durationRatio: 1,
          countAccessCount: 0,
        },
        now,
      ),
    ).toEqual([
      {
        ...challenges[0],
        current: 1,
        completed: true,
        completedAt: now,
      },
    ])
  })

  it('completes the silver zero_access challenge after three access-free hours', () => {
    const challenges: DailyChallenge[] = [
      {
        id: 'silver-id',
        date: '2026-03-19',
        tier: 'silver',
        type: 'zero_access',
        description: '3時間アクセス試行ゼロを達成する',
        target: 3,
        current: 0,
        completed: false,
        completedAt: null,
      },
    ]

    expect(
      updateChallengeProgress(
        challenges,
        {
          bypassCount: 1,
          accessFreeHours: 3,
          allRulesKept: false,
          durationRatio: 1,
          countAccessCount: 0,
        },
        now,
      ),
    ).toEqual([
      {
        ...challenges[0],
        current: 3,
        completed: true,
        completedAt: now,
      },
    ])
  })

  it('completes the gold all_rules_kept challenge when all rules are kept', () => {
    const challenges: DailyChallenge[] = [
      {
        id: 'gold-id',
        date: '2026-03-19',
        tier: 'gold',
        type: 'all_rules_kept',
        description: '今日は全ルールを24時間守りきる',
        target: 1,
        current: 0,
        completed: false,
        completedAt: null,
      },
    ]

    expect(
      updateChallengeProgress(
        challenges,
        {
          bypassCount: 1,
          accessFreeHours: 1,
          allRulesKept: true,
          durationRatio: 1,
          countAccessCount: 0,
        },
        now,
      ),
    ).toEqual([
      {
        ...challenges[0],
        current: 1,
        completed: true,
        completedAt: now,
      },
    ])
  })

  it('does not change challenges that are already completed', () => {
    const challenges: DailyChallenge[] = [
      {
        id: 'gold-id',
        date: '2026-03-19',
        tier: 'gold',
        type: 'all_rules_kept',
        description: '今日は全ルールを24時間守りきる',
        target: 1,
        current: 1,
        completed: true,
        completedAt: 123,
      },
    ]

    expect(
      updateChallengeProgress(
        challenges,
        {
          bypassCount: 0,
          accessFreeHours: 4,
          allRulesKept: false,
          durationRatio: 0.4,
          countAccessCount: 0,
        },
        now,
      ),
    ).toEqual(challenges)
  })
})

describe('shouldResetChallenges', () => {
  it('returns true when the generated date differs from today', () => {
    expect(
      shouldResetChallenges(
        {
          challenges: [],
          lastGeneratedDate: '2026-03-18',
        },
        '2026-03-19',
      ),
    ).toBe(true)
  })

  it('returns false when the generated date matches today', () => {
    expect(
      shouldResetChallenges(
        {
          challenges: [],
          lastGeneratedDate: '2026-03-19',
        },
        '2026-03-19',
      ),
    ).toBe(false)
  })
})

describe('getChallengeSummary', () => {
  it('returns zero completed when no challenge is done', () => {
    expect(getChallengeSummary([])).toEqual({
      total: 0,
      completed: 0,
      goldCompleted: false,
    })
  })

  it('returns a partial completion summary', () => {
    expect(
      getChallengeSummary([
        {
          id: 'bronze-id',
          date: '2026-03-19',
          tier: 'bronze',
          type: 'no_bypass',
          description: '',
          target: 1,
          current: 1,
          completed: true,
          completedAt: 1,
        },
        {
          id: 'silver-id',
          date: '2026-03-19',
          tier: 'silver',
          type: 'zero_access',
          description: '',
          target: 3,
          current: 1,
          completed: false,
          completedAt: null,
        },
      ]),
    ).toEqual({
      total: 2,
      completed: 1,
      goldCompleted: false,
    })
  })

  it('detects a completed gold challenge', () => {
    expect(
      getChallengeSummary([
        {
          id: 'bronze-id',
          date: '2026-03-19',
          tier: 'bronze',
          type: 'no_bypass',
          description: '',
          target: 1,
          current: 1,
          completed: true,
          completedAt: 1,
        },
        {
          id: 'silver-id',
          date: '2026-03-19',
          tier: 'silver',
          type: 'zero_access',
          description: '',
          target: 3,
          current: 3,
          completed: true,
          completedAt: 2,
        },
        {
          id: 'gold-id',
          date: '2026-03-19',
          tier: 'gold',
          type: 'all_rules_kept',
          description: '',
          target: 1,
          current: 1,
          completed: true,
          completedAt: 3,
        },
      ]),
    ).toEqual({
      total: 3,
      completed: 3,
      goldCompleted: true,
    })
  })
})
