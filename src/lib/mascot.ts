import type { MascotState } from './types'

export const MASCOT_LEVELS = [
  { level: 0, name: 'たまご', emoji: '🥚', requiredFeeds: 0 },
  { level: 1, name: 'ひよこ', emoji: '🐣', requiredFeeds: 3 },
  { level: 2, name: '見習い', emoji: '🛡', requiredFeeds: 7 },
  { level: 3, name: '戦士', emoji: '⚔️', requiredFeeds: 15 },
  { level: 4, name: 'マスター', emoji: '👑', requiredFeeds: 30 },
] as const

export type MascotLevelInfo = (typeof MASCOT_LEVELS)[number]
export type MascotMood = 'happy' | 'proud' | 'worried' | 'sad' | 'very_sad' | 'anxious' | 'crying'

export interface MascotMoodInfo {
  mood: MascotMood
  message: string
}

function normalizeFeedCount(feedCount: number): number {
  if (!Number.isFinite(feedCount) || feedCount <= 0) {
    return 0
  }

  return Math.floor(feedCount)
}

function getLevelInfo(level: number): MascotLevelInfo {
  return MASCOT_LEVELS[level] ?? MASCOT_LEVELS[0]
}

export function calculateLevel(feedCount: number): number {
  const normalizedFeedCount = normalizeFeedCount(feedCount)
  let currentLevel = 0

  for (const levelInfo of MASCOT_LEVELS) {
    if (normalizedFeedCount >= levelInfo.requiredFeeds) {
      currentLevel = levelInfo.level
    }
  }

  return currentLevel
}

export function feedMascot(state: MascotState, now: number): MascotState {
  const feedCount = normalizeFeedCount(state.feedCount) + 1

  return {
    level: calculateLevel(feedCount),
    feedCount,
    lastFedAt: now,
  }
}

export function checkLevelUp(
  previousState: MascotState,
  currentState: MascotState,
): {
  leveledUp: boolean
  previousLevel: number
  currentLevel: number
  levelInfo: MascotLevelInfo | null
} {
  const previousLevel = calculateLevel(previousState.feedCount)
  const currentLevel = calculateLevel(currentState.feedCount)
  const leveledUp = currentLevel > previousLevel

  return {
    leveledUp,
    previousLevel,
    currentLevel,
    levelInfo: leveledUp ? getLevelInfo(currentLevel) : null,
  }
}

export function getMascotInfo(state: MascotState): {
  level: number
  name: string
  emoji: string
  feedCount: number
  feedsUntilNextLevel: number | null
  nextLevelName: string | null
} {
  const feedCount = normalizeFeedCount(state.feedCount)
  const level = calculateLevel(feedCount)
  const levelInfo = getLevelInfo(level)
  const nextLevelInfo = MASCOT_LEVELS[level + 1] ?? null

  return {
    level,
    name: levelInfo.name,
    emoji: levelInfo.emoji,
    feedCount,
    feedsUntilNextLevel: nextLevelInfo ? nextLevelInfo.requiredFeeds - feedCount : null,
    nextLevelName: nextLevelInfo ? nextLevelInfo.name : null,
  }
}

export function getMascotMood(context: {
  streakActive: boolean
  streakDays: number
  bypassUsedToday: boolean
  bypassWithoutPass: boolean
  daysSinceLastStreak: number
}): MascotMoodInfo {
  if (context.daysSinceLastStreak >= 3) {
    return {
      mood: 'crying',
      message: '戻ってきてくれたんだ..!',
    }
  }

  if (context.bypassWithoutPass) {
    return {
      mood: 'very_sad',
      message: 'うう...今日は辛い日だね',
    }
  }

  if (context.bypassUsedToday) {
    return {
      mood: 'sad',
      message: 'ちょっと寂しいな...',
    }
  }

  if (!context.streakActive && context.daysSinceLastStreak === 0) {
    return {
      mood: 'anxious',
      message: '最後まで頑張ろう!',
    }
  }

  if (context.streakActive && context.streakDays > 0) {
    return {
      mood: 'proud',
      message: '守ってるね!',
    }
  }

  return {
    mood: 'happy',
    message: '今日も頑張ってるね!',
  }
}
