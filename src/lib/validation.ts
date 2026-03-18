import type {
  AuthState,
  AuthUser,
  BackgroundState,
  BlockRule,
  BypassEntry,
  BypassState,
  CooldownState,
  CustomQuote,
  DailyStats,
  DeletedMap,
  GroupRule,
  LicenseCache,
  LicensePlan,
  Location,
  LocationState,
  LockModeLevel,
  LockModeSettings,
  MascotState,
  RestrictionConfig,
  RescuePass,
  Settings,
  SiteRule,
  StreakData,
  StreakDisplayMode,
  StreakRecord,
  SyncState,
  SyncStatus,
  UIMode,
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

export function isCooldownState(value: unknown): value is CooldownState {
  return (
    isRecord(value) &&
    isRecord(value.lastAccess) &&
    Object.values(value.lastAccess).every((entry) => typeof entry === 'number')
  )
}

export function isDeletedMap(value: unknown): value is DeletedMap {
  return (
    isRecord(value) &&
    isRecord(value.blockRules) &&
    Object.values(value.blockRules).every((entry) => typeof entry === 'number') &&
    isRecord(value.locations) &&
    Object.values(value.locations).every((entry) => typeof entry === 'number') &&
    isRecord(value.customQuotes) &&
    Object.values(value.customQuotes).every((entry) => typeof entry === 'number') &&
    isRecord(value.dailyStats) &&
    Object.values(value.dailyStats).every((entry) => typeof entry === 'number')
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
    typeof value.totalEarned === 'number' &&
    typeof value.totalUsed === 'number' &&
    typeof value.totalFed === 'number'
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

export function isStreakRecord(value: unknown): value is StreakRecord {
  return isRecord(value) && typeof value.date === 'string' && typeof value.success === 'boolean'
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

export function isSyncStatus(value: unknown): value is SyncStatus {
  return (
    value === 'disabled' ||
    value === 'idle' ||
    value === 'syncing' ||
    value === 'error' ||
    value === 'offline'
  )
}

export function isSyncState(value: unknown): value is SyncState {
  return (
    isRecord(value) &&
    isSyncStatus(value.status) &&
    (typeof value.lastSyncedAt === 'number' || value.lastSyncedAt === null) &&
    (typeof value.lastError === 'string' || value.lastError === null) &&
    typeof value.pendingPush === 'boolean' &&
    typeof value.isApplyingRemote === 'boolean'
  )
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.uid === 'string' &&
    typeof value.email === 'string' &&
    (typeof value.displayName === 'string' || value.displayName === null) &&
    (typeof value.photoURL === 'string' || value.photoURL === null)
  )
}

export function isAuthState(value: unknown): value is AuthState {
  return (
    isRecord(value) &&
    (value.status === 'anonymous' || value.status === 'authenticated' || value.status === 'error') &&
    (value.user === null || isAuthUser(value.user)) &&
    (typeof value.lastError === 'string' || value.lastError === null)
  )
}

export function isLicensePlan(value: unknown): value is LicensePlan {
  return value === 'free' || value === 'pro' || value === 'cloud'
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
    isSyncState(value.syncState) &&
    isAuthState(value.authState) &&
    isLicenseCache(value.licenseCache)
  )
}
