import {
  STREAK_DAY_STATUSES,
  type BackgroundState,
  type BlockRule,
  type BypassEntry,
  type BypassState,
  type CooldownState,
  type CustomQuote,
  type DailyStats,
  type GroupRule,
  type LicenseCache,
  type LicensePlan,
  type Location,
  type LocationState,
  type LockModeLevel,
  type LockModeSettings,
  type RestrictionConfig,
  type ScreenTimeGoal,
  type Settings,
  type SiteRule,
  type StreakData,
  type StreakDayStatus,
  type StreakDisplayMode,
  type StreakRecord,
} from './types'

type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function normalizeRulePattern(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed || /[\s\0-\x1f\x7f]/.test(trimmed)) return null
  if (trimmed.includes('@')) return null

  let candidate = trimmed.toLowerCase()

  if (candidate.startsWith('*.')) {
    candidate = candidate.slice(2)
  } else if (candidate.startsWith('*://*.')) {
    candidate = candidate.slice(6)
  } else if (candidate.startsWith('*://')) {
    candidate = candidate.slice(4)
  }

  try {
    const parsed = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
    candidate = parsed.hostname
  } catch {
    candidate = candidate
      .replace(/^https?:\/\//i, '')
      .split(/[/?#]/, 1)[0]
  }

  if (candidate.startsWith('*.')) candidate = candidate.slice(2)
  if (candidate.startsWith('www.')) candidate = candidate.slice(4)

  const portSeparator = candidate.lastIndexOf(':')
  if (portSeparator > -1 && candidate.indexOf(':') === portSeparator) {
    candidate = candidate.slice(0, portSeparator)
  }

  if (!candidate || candidate.includes('@')) return null
  if (/[!*'();,|^<>[\]{}\\]/.test(candidate)) return null
  if (candidate.endsWith('.')) candidate = candidate.slice(0, -1)
  if (candidate.length > 253) return null

  if (candidate === 'localhost') return candidate

  const labels = candidate.split('.')
  if (labels.length < 2) return null

  const isValidLabel = (label: string): boolean =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9-]+$/.test(label) &&
    !label.startsWith('-') &&
    !label.endsWith('-')

  return labels.every(isValidLabel) ? candidate : null
}

function isDayOfWeek(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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
      return isFiniteNumber(value.maxCount) && value.maxCount > 0
    case 'daily_duration':
      return isFiniteNumber(value.maxMinutes) && value.maxMinutes > 0
    case 'cooldown':
      return isFiniteNumber(value.cooldownMinutes) && value.cooldownMinutes > 0
    case 'delay':
      return isFiniteNumber(value.delaySeconds) && value.delaySeconds > 0
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
    isFiniteNumber(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    isFiniteNumber(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180 &&
    isFiniteNumber(value.radiusMeters) &&
    value.radiusMeters > 0
  )
}

export function isSiteRule(value: unknown): value is SiteRule {
  return (
    isRecord(value) &&
    value.type === 'site' &&
    typeof value.id === 'string' &&
    normalizeRulePattern(value.url) !== null &&
    Array.isArray(value.restrictions) &&
    value.restrictions.every(isRestrictionConfig) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  )
}

export function isGroupRule(value: unknown): value is GroupRule {
  return (
    isRecord(value) &&
    value.type === 'group' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.urls) &&
    value.urls.every((url) => normalizeRulePattern(url) !== null) &&
    Array.isArray(value.restrictions) &&
    value.restrictions.every(isRestrictionConfig) &&
    typeof value.preset === 'boolean' &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  )
}

export function isBlockRule(value: unknown): value is BlockRule {
  return isSiteRule(value) || isGroupRule(value)
}

export function isStreakDisplayMode(value: unknown): value is StreakDisplayMode {
  return value === 'number' || value === 'heatmap'
}

export function isCustomQuote(value: unknown): value is CustomQuote {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
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
      isFiniteNumber(value.nuclearUntil) ||
      value.nuclearUntil === null ||
      value.nuclearUntil === undefined
    ) &&
    (
      isFiniteNumber(value.delayUnlockUntil) ||
      value.delayUnlockUntil === null ||
      value.delayUnlockUntil === undefined
    ) &&
    isFiniteNumber(value.updatedAt)
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
    isStringArray(value.freeActiveRuleIds) &&
    typeof value.adultFilter === 'boolean' &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocation) &&
    isStreakDisplayMode(value.streakDisplayMode) &&
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
    Object.values(value.counts).every(isFiniteNumber) &&
    isRecord(value.durations) &&
    Object.values(value.durations).every(isFiniteNumber)
  )
}

export function isCooldownState(value: unknown): value is CooldownState {
  return (
    isRecord(value) &&
    isRecord(value.lastAccess) &&
    Object.values(value.lastAccess).every(isFiniteNumber)
  )
}

export function isBypassEntry(value: unknown): value is BypassEntry {
  return (
    isRecord(value) &&
    typeof value.ruleId === 'string' &&
    isFiniteNumber(value.expiresAt) &&
    isFiniteNumber(value.createdAt)
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
    (isFiniteNumber(value.lastCheckedAt) || value.lastCheckedAt === null) &&
    (typeof value.lastError === 'string' || value.lastError === null)
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
    isFiniteNumber(value.updatedAt)
  )
}

export function isLicensePlan(value: unknown): value is LicensePlan {
  return value === 'free' || value === 'pro'
}

export function isLicenseCache(value: unknown): value is LicenseCache {
  return (
    isRecord(value) &&
    isLicensePlan(value.plan) &&
    (isFiniteNumber(value.lastVerified) || value.lastVerified === null) &&
    (value.source === 'default' || value.source === 'local' || value.source === 'cloud') &&
    (isFiniteNumber(value.expiresAt) || value.expiresAt === null) &&
    (
      value.email === undefined ||
      value.email === null ||
      typeof value.email === 'string'
    )
  )
}

export function isBackgroundState(value: unknown): value is BackgroundState {
  return (
    isRecord(value) &&
    (value.trialStartDate === undefined || isFiniteNumber(value.trialStartDate)) &&
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
