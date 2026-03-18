import { describe, expect, it } from 'vitest'
import type { MascotState } from '../types'
import {
  MASCOT_LEVELS,
  calculateLevel,
  checkLevelUp,
  feedMascot,
  getMascotInfo,
  getMascotMood,
} from '../mascot'

describe('calculateLevel', () => {
  it('returns the correct level for feed count thresholds', () => {
    expect(calculateLevel(0)).toBe(0)
    expect(calculateLevel(1)).toBe(0)
    expect(calculateLevel(2)).toBe(0)
    expect(calculateLevel(3)).toBe(1)
    expect(calculateLevel(7)).toBe(2)
    expect(calculateLevel(15)).toBe(3)
    expect(calculateLevel(30)).toBe(4)
    expect(calculateLevel(50)).toBe(4)
  })
})

describe('feedMascot', () => {
  it('increments feed count, updates the timestamp, and keeps the current level when below threshold', () => {
    const state: MascotState = {
      level: 0,
      feedCount: 1,
      lastFedAt: 1000,
    }

    expect(feedMascot(state, 2000)).toEqual({
      level: 0,
      feedCount: 2,
      lastFedAt: 2000,
    })
  })

  it('recalculates the level after feeding', () => {
    const state: MascotState = {
      level: 0,
      feedCount: 2,
      lastFedAt: null,
    }

    expect(feedMascot(state, 3000)).toEqual({
      level: 1,
      feedCount: 3,
      lastFedAt: 3000,
    })
  })
})

describe('checkLevelUp', () => {
  it('returns level up details when the mascot crosses a threshold', () => {
    const previousState: MascotState = {
      level: 0,
      feedCount: 2,
      lastFedAt: null,
    }
    const currentState: MascotState = {
      level: 1,
      feedCount: 3,
      lastFedAt: 4000,
    }

    expect(checkLevelUp(previousState, currentState)).toEqual({
      leveledUp: true,
      previousLevel: 0,
      currentLevel: 1,
      levelInfo: MASCOT_LEVELS[1],
    })
  })

  it('returns no level up when the level stays the same', () => {
    const previousState: MascotState = {
      level: 1,
      feedCount: 3,
      lastFedAt: null,
    }
    const currentState: MascotState = {
      level: 1,
      feedCount: 4,
      lastFedAt: 5000,
    }

    expect(checkLevelUp(previousState, currentState)).toEqual({
      leveledUp: false,
      previousLevel: 1,
      currentLevel: 1,
      levelInfo: null,
    })
  })
})

describe('getMascotInfo', () => {
  it('returns current level info and remaining feeds to next level', () => {
    expect(
      getMascotInfo({
        level: 1,
        feedCount: 5,
        lastFedAt: null,
      }),
    ).toEqual({
      level: 1,
      name: 'ひよこ',
      emoji: '🐣',
      feedCount: 5,
      feedsUntilNextLevel: 2,
      nextLevelName: '見習い',
    })
  })

  it('returns null next level values at max level', () => {
    expect(
      getMascotInfo({
        level: 4,
        feedCount: 30,
        lastFedAt: null,
      }),
    ).toEqual({
      level: 4,
      name: 'マスター',
      emoji: '👑',
      feedCount: 30,
      feedsUntilNextLevel: null,
      nextLevelName: null,
    })
  })
})

describe('getMascotMood', () => {
  it('returns crying for long inactivity', () => {
    expect(
      getMascotMood({
        streakActive: false,
        streakDays: 0,
        bypassUsedToday: false,
        bypassWithoutPass: false,
        daysSinceLastStreak: 3,
      }),
    ).toEqual({
      mood: 'crying',
      message: '戻ってきてくれたんだ..!',
    })
  })

  it('returns very sad when a bypass happened without a pass', () => {
    expect(
      getMascotMood({
        streakActive: false,
        streakDays: 0,
        bypassUsedToday: true,
        bypassWithoutPass: true,
        daysSinceLastStreak: 1,
      }),
    ).toEqual({
      mood: 'very_sad',
      message: 'うう...今日は辛い日だね',
    })
  })

  it('returns sad when a bypass happened with a pass', () => {
    expect(
      getMascotMood({
        streakActive: false,
        streakDays: 4,
        bypassUsedToday: true,
        bypassWithoutPass: false,
        daysSinceLastStreak: 0,
      }),
    ).toEqual({
      mood: 'sad',
      message: 'ちょっと寂しいな...',
    })
  })

  it('returns anxious when the streak is at risk today', () => {
    expect(
      getMascotMood({
        streakActive: false,
        streakDays: 0,
        bypassUsedToday: false,
        bypassWithoutPass: false,
        daysSinceLastStreak: 0,
      }),
    ).toEqual({
      mood: 'anxious',
      message: '最後まで頑張ろう!',
    })
  })

  it('returns proud while actively protecting an established streak', () => {
    expect(
      getMascotMood({
        streakActive: true,
        streakDays: 5,
        bypassUsedToday: false,
        bypassWithoutPass: false,
        daysSinceLastStreak: 0,
      }),
    ).toEqual({
      mood: 'proud',
      message: '守ってるね!',
    })
  })

  it('returns happy as the default encouragement', () => {
    expect(
      getMascotMood({
        streakActive: true,
        streakDays: 0,
        bypassUsedToday: false,
        bypassWithoutPass: false,
        daysSinceLastStreak: 1,
      }),
    ).toEqual({
      mood: 'happy',
      message: '今日も頑張ってるね!',
    })
  })
})
