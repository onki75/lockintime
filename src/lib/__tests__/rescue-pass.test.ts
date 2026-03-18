import { describe, expect, it } from 'vitest'
import { DEFAULT_RESCUE_PASS } from '../defaults'
import {
  calculateEarnedPasses,
  consumeFreeze,
  expandFrozenMax,
  getProgressToNextPass,
  initTrialPasses,
  usePassForBypass,
  usePassForFeed,
  usePassForFreeze,
} from '../rescue-pass'

describe('calculateEarnedPasses', () => {
  it('returns cumulative earned passes across streak milestones', () => {
    expect(calculateEarnedPasses(0)).toBe(0)
    expect(calculateEarnedPasses(1)).toBe(0)
    expect(calculateEarnedPasses(7)).toBe(2)
    expect(calculateEarnedPasses(30)).toBe(8)
    expect(calculateEarnedPasses(100)).toBe(23)
    expect(calculateEarnedPasses(365)).toBe(83)
  })
})

describe('usePassForBypass', () => {
  it('consumes one pass for a bypass', () => {
    expect(
      usePassForBypass({
        ...DEFAULT_RESCUE_PASS,
        available: 3,
        totalEarned: 3,
      }),
    ).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 2,
      totalEarned: 3,
      totalUsedBypass: 1,
    })
  })

  it('throws when no passes are available', () => {
    expect(() => usePassForBypass(DEFAULT_RESCUE_PASS)).toThrow('Rescue pass is not available')
  })
})

describe('usePassForFreeze', () => {
  it('equips one streak freeze', () => {
    expect(
      usePassForFreeze({
        ...DEFAULT_RESCUE_PASS,
        available: 2,
        totalEarned: 2,
      }),
    ).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 1,
      frozenCount: 1,
      totalEarned: 2,
      totalUsedFreeze: 1,
    })
  })

  it('throws when the freeze capacity is full', () => {
    expect(() =>
      usePassForFreeze({
        ...DEFAULT_RESCUE_PASS,
        available: 1,
        frozenCount: 2,
        frozenMax: 2,
        totalEarned: 1,
      }),
    ).toThrow('Freeze slots are full')
  })

  it('throws when no passes are available', () => {
    expect(() => usePassForFreeze(DEFAULT_RESCUE_PASS)).toThrow('Rescue pass is not available')
  })
})

describe('usePassForFeed', () => {
  it('consumes one pass for feed', () => {
    expect(
      usePassForFeed({
        ...DEFAULT_RESCUE_PASS,
        available: 4,
        totalEarned: 4,
      }),
    ).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 3,
      totalEarned: 4,
      totalUsedFeed: 1,
    })
  })

  it('throws when no passes are available', () => {
    expect(() => usePassForFeed(DEFAULT_RESCUE_PASS)).toThrow('Rescue pass is not available')
  })
})

describe('consumeFreeze', () => {
  it('consumes one equipped freeze', () => {
    expect(
      consumeFreeze({
        ...DEFAULT_RESCUE_PASS,
        available: 1,
        frozenCount: 2,
        frozenMax: 3,
        totalEarned: 3,
        totalUsedFreeze: 2,
      }),
    ).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 1,
      frozenCount: 1,
      frozenMax: 3,
      totalEarned: 3,
      totalUsedFreeze: 2,
    })
  })

  it('throws when no freeze is equipped', () => {
    expect(() => consumeFreeze(DEFAULT_RESCUE_PASS)).toThrow('Freeze is not equipped')
  })
})

describe('expandFrozenMax', () => {
  it('expands the freeze capacity without changing the current count', () => {
    expect(
      expandFrozenMax({
        ...DEFAULT_RESCUE_PASS,
        available: 1,
        frozenCount: 1,
        frozenMax: 2,
        totalEarned: 2,
      }, 4),
    ).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 1,
      frozenCount: 1,
      frozenMax: 4,
      totalEarned: 2,
    })
  })
})

describe('getProgressToNextPass', () => {
  it('returns progress before the first pass', () => {
    expect(getProgressToNextPass(0)).toEqual({
      earned: 0,
      total: 7,
      daysUntilNext: 7,
    })

    expect(getProgressToNextPass(1)).toEqual({
      earned: 1,
      total: 7,
      daysUntilNext: 6,
    })
  })

  it('resets progress after an earned day and handles milestone intervals', () => {
    expect(getProgressToNextPass(7)).toEqual({
      earned: 0,
      total: 7,
      daysUntilNext: 7,
    })

    expect(getProgressToNextPass(29)).toEqual({
      earned: 1,
      total: 2,
      daysUntilNext: 1,
    })

    expect(getProgressToNextPass(30)).toEqual({
      earned: 0,
      total: 5,
      daysUntilNext: 5,
    })

    expect(getProgressToNextPass(100)).toEqual({
      earned: 0,
      total: 5,
      daysUntilNext: 5,
    })

    expect(getProgressToNextPass(101)).toEqual({
      earned: 1,
      total: 5,
      daysUntilNext: 4,
    })
  })
})

describe('initTrialPasses', () => {
  it('starts free users with two rescue passes', () => {
    expect(initTrialPasses()).toEqual({
      ...DEFAULT_RESCUE_PASS,
      available: 2,
      totalEarned: 2,
    })
  })
})
