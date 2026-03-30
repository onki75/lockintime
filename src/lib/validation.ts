import {
  STREAK_DAY_STATUSES,
  type BackgroundState,
  type BlockRule,
  type BypassEntry,
  type BypassState,
  type ChallengeTier,
  type ChallengeType,
  type CooldownState,
  type CustomQuote,
  type DailyChallenge,
  type DailyChallengeState,
  type DailyStats,
  type GroupRule,
  type LicenseCache,
  type LicensePlan,
  type Location,
  type LocationState,
  type LockModeLevel,
  type LockModeSettings,
  type MascotState,
  type RestrictionConfig,
  type RescuePass,
  type ScreenTimeGoal,
  type Settings,
  type SiteRule,
  type StreakData,
  type StreakDayStatus,
  type StreakDisplayMode,
  type StreakRecord,
  type UIMode,
} from './types'

type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isDayOfWeek(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

export function isRestrictionConfig(value: unknown): value is RestrictionConfig {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'full_block':
      return true
    case 'time_of_day':
      return (
        Array.isArray(value.schedule) &&
        value.schedule.every(
          (entry) =>
            isRecord(entry) &&
            Array.isArray(entry.days) &&
            entry.days.every(isDayOfWeek) &&
            typeof entry.startTime === 'string' &&
            typeof entry.endTime === 'string',
        )
      )
    case 'daily_count':
      return typeof value.maxCount === 'number'
    case 'daily_duration':
      return typeof value.maxMinutes === 'number'
    case 'cooldown':
      return typeof value.cooldownMinutes === 'number'
    case 'delay':
      return typeof value.delaySeconds === 'number'
    case 'location':
      return isStringArray(value.locationIds)
    default:
      return false
  }
}

export function isLocation(value: unknown): value is Location {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.radiusMeters === 'number'
  )
}

export function isSiteRule(value: unknown): value is SiteRule {
  return (
    isRecord(value) &&
    value.type === 'site' &&
    typeof value.id === 'string' &&
    typeof value.url === 'string' &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.restrictions) &&
    value.restrictions.every(isRestrictionConfig) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

export function isGroupRule(value: unknown): value is GroupRule {
  return (
    isRecord(value) &&
    value.type === 'group' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.urls) &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.restrictions) &&
    value.restrictions.every(isRestrictionConfig) &&
    typeof value.preset === 'boolean' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

export function isBlockRule(value: unknown): value is BlockRule {
  return isSiteRule(value) || isGroupRule(value)
}

export function isStreakDisplayMode(value: unknown): value is StreakDisplayMode {
  return value === 'number' || value === 'heatmap'
}

export function isUIMode(value: unknown): value is UIMode {
  return value === 'mascot' || value === 'simple'
}

export function isCustomQuote(value: unknown): value is CustomQuote {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

export function isLockModeLevel(value: unknown): value is LockModeLevel {
  return value === 'off' || value === 'soft' || value === 'hard' || value === 'nuclear'
}

export function isLockModeSettings(value: unknown): value is LockModeSettings {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    isLockModeLevel(value.level) &&
    (typeof value.passwordHash === 'string' || value.passwordHash === null) &&
    (
      typeof value.passwordSalt === 'string' ||
      value.passwordSalt === null ||
      value.passwordSalt === undefined
    ) &&
    (
      typeof value.challengeText === 'string' ||
      value.challengeText === null ||
      value.challengeText === undefined
    ) &&
    (
      typeof value.nuclearUntil === 'number' ||
      value.nuclearUntil === null ||
      value.nuclearUntil === undefined
    ) &&
    (
      typeof value.delayUnlockUntil === 'number' ||
      value.delayUnlockUntil === null ||
      value.delayUnlockUntil === undefined
    ) &&
    typeof value.updatedAt === 'number'
  )
}

export function isScreenTimeGoal(value: unknown): value is ScreenTimeGoal {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.dailyLimitMinutes === 'number' &&
    Number.isFinite(value.dailyLimitMinutes) &&
    value.dailyLimitMinutes >= 0
  )
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    Array.isArray(value.blockRules) &&
    value.blockRules.every(isBlockRule) &&
    typeof value.adultFilter === 'boolean' &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocation) &&
    isStreakDisplayMode(value.streakDisplayMode) &&
    isUIMode(value.uiMode) &&
    Array.isArray(value.customQuotes) &&
    value.customQuotes.every(isCustomQuote) &&
    (value.screenTimeGoal === undefined || isScreenTimeGoal(value.screenTimeGoal)) &&
    isLockModeSettings(value.lockMode) &&
    typeof value.updatedAt === 'number'
  )
}

export function isDailyStats(value: unknown): value is DailyStats {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isRecord(value.counts) &&
    Object.values(value.counts).every((entry) => typeof entry === 'number') &&
    isRecord(value.durations) &&
    Object.values(value.durations).every((entry) => typeof entry === 'number')
  )
}

export function isChallengeTier(value: unknown): value is ChallengeTier {
  return value === 'bronze' || value === 'silver' || value === 'gold'
}

export function isChallengeType(value: unknown): value is ChallengeType {
  return (
    value === 'no_bypass' ||
    value === 'zero_access' ||
    value === 'all_rules_kept' ||
    value === 'under_half_limit' ||
    value === 'no_count_access'
  )
}

export function isDailyChallenge(value: unknown): value is DailyChallenge {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    isChallengeTier(value.tier) &&
    isChallengeType(value.type) &&
    typeof value.description === 'string' &&
    typeof value.target === 'number' &&
    typeof value.current === 'number' &&
    typeof value.completed === 'boolean' &&
    (typeof value.completedAt === 'number' || value.completedAt === null)
  )
}

export function isDailyChallengeState(value: unknown): value is DailyChallengeState {
  return (
    isRecord(value) &&
    Array.isArray(value.challenges) &&
    value.challenges.every(isDailyChallenge) &&
    typeof value.lastGeneratedDate === 'string'
  )
}

export function isCooldownState(value: unknown): value is CooldownState {
  return (
    isRecord(value) &&
    isRecord(value.lastAccess) &&
    Object.values(value.lastAccess).every((entry) => typeof entry === 'number')
  )
}

export function isBypassEntry(value: unknown): value is BypassEntry {
  return (
    isRecord(value) &&
    typeof value.ruleId === 'string' &&
    typeof value.expiresAt === 'number' &&
    typeof value.createdAt === 'number'
  )
}

export function isBypassState(value: unknown): value is BypassState {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every(isBypassEntry)
}

export function isLocationState(value: unknown): value is LocationState {
  return (
    isRecord(value) &&
    Array.isArray(value.activeLocationIds) &&
    value.activeLocationIds.every((entry) => typeof entry === 'string') &&
    (typeof value.lastCheckedAt === 'number' || value.lastCheckedAt === null) &&
    (typeof value.lastError === 'string' || value.lastError === null)
  )
}

export function isRescuePass(value: unknown): value is RescuePass {
  return (
    isRecord(value) &&
    typeof value.available === 'number' &&
    typeof value.frozenCount === 'number' &&
    typeof value.frozenMax === 'number' &&
    typeof value.totalEarned === 'number' &&
    typeof value.totalUsedBypass === 'number' &&
    typeof value.totalUsedFreeze === 'number' &&
    typeof value.totalUsedFeed === 'number'
  )
}

export function isMascotState(value: unknown): value is MascotState {
  return (
    isRecord(value) &&
    typeof value.level === 'number' &&
    typeof value.feedCount === 'number' &&
    (typeof value.lastFedAt === 'number' || value.lastFedAt === null)
  )
}

export function isStreakDayStatus(value: unknown): value is StreakDayStatus {
  return typeof value === 'string' && STREAK_DAY_STATUSES.includes(value as StreakDayStatus)
}

export function isStreakRecord(value: unknown): value is StreakRecord {
  if (!isRecord(value) || typeof value.date !== 'string' || typeof value.success !== 'boolean') {
    return false
  }

  if (value.status === undefined) {
    return true
  }

  return isStreakDayStatus(value.status) && value.success === (value.status !== 'failure')
}

export function isStreakData(value: unknown): value is StreakData {
  return (
    isRecord(value) &&
    isRecord(value.perRule) &&
    Object.values(value.perRule).every(
      (records) => Array.isArray(records) && records.every(isStreakRecord),
    ) &&
    Array.isArray(value.global) &&
    value.global.every(isStreakRecord) &&
    typeof value.updatedAt === 'number'
  )
}

export function isLicensePlan(value: unknown): value is LicensePlan {
  return value === 'free' || value === 'pro'
}

export function isLicenseCache(value: unknown): value is LicenseCache {
  return (
    isRecord(value) &&
    isLicensePlan(value.plan) &&
    (typeof value.lastVerified === 'number' || value.lastVerified === null) &&
    (value.source === 'default' || value.source === 'local' || value.source === 'cloud') &&
    (typeof value.expiresAt === 'number' || value.expiresAt === null)
  )
}

export function isBackgroundState(value: unknown): value is BackgroundState {
  return (
    isRecord(value) &&
    (value.trialStartDate === undefined || typeof value.trialStartDate === 'number') &&
    (value.dailyStats === null || value.dailyStats === undefined || isDailyStats(value.dailyStats)) &&
    isRecord(value.dailyStatsHistory) &&
    Object.values(value.dailyStatsHistory).every(isDailyStats) &&
    isCooldownState(value.cooldownState) &&
    isBypassState(value.bypassState) &&
    isLocationState(value.locationState) &&
    isStreakData(value.streakData) &&
    isLicenseCache(value.licenseCache)
  )
}
