import type {
  BackgroundState,
  BypassState,
  CooldownState,
  DailyStats,
  LicenseCache,
  LocationState,
  LockModeSettings,
  ScreenTimeGoal,
  Settings,
  StreakData,
} from './types'

export const DEFAULT_LOCK_MODE: LockModeSettings = {
  enabled: false,
  level: 'off',
  passwordHash: null,
  passwordSalt: null,
  challengeText: null,
  nuclearUntil: null,
  delayUnlockUntil: null,
  updatedAt: 0,
}

export const DEFAULT_SCREEN_TIME_GOAL: ScreenTimeGoal = {
  enabled: false,
  dailyLimitMinutes: 30,
}

export const DEFAULT_SETTINGS: Settings = {
  blockRules: [],
  freeActiveRuleIds: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
  customQuotes: [],
  screenTimeGoal: structuredClone(DEFAULT_SCREEN_TIME_GOAL),
  lockMode: structuredClone(DEFAULT_LOCK_MODE),
  updatedAt: 0,
}

export const DEFAULT_STREAK_DATA: StreakData = {
  perRule: {},
  global: [],
  updatedAt: 0,
}

export const DEFAULT_COOLDOWN_STATE: CooldownState = {
  lastAccess: {},
}

export const DEFAULT_BYPASS_STATE: BypassState = {
  entries: [],
}

export const DEFAULT_LOCATION_STATE: LocationState = {
  activeLocationIds: [],
  lastCheckedAt: null,
  lastError: null,
}

export const DEFAULT_LICENSE_CACHE: LicenseCache = {
  plan: 'free',
  lastVerified: null,
  source: 'default',
  expiresAt: null,
  email: null,
}

export const DEFAULT_BACKGROUND_STATE: BackgroundState = {
  dailyStats: null,
  dailyStatsHistory: {},
  cooldownState: structuredClone(DEFAULT_COOLDOWN_STATE),
  bypassState: structuredClone(DEFAULT_BYPASS_STATE),
  locationState: structuredClone(DEFAULT_LOCATION_STATE),
  streakData: structuredClone(DEFAULT_STREAK_DATA),
  licenseCache: structuredClone(DEFAULT_LICENSE_CACHE),
}

export const DEFAULT_AUTH_STATE = {}
export const DEFAULT_DELETED_MAP = {}
export const DEFAULT_MASCOT_STATE = {}
export const DEFAULT_RESCUE_PASS = {}
export const DEFAULT_SYNC_STATE = {}

export function cloneSettings(settings: Settings): Settings {
  return structuredClone(settings)
}

export function cloneDailyStats(dailyStats: DailyStats): DailyStats {
  return structuredClone(dailyStats)
}

export function cloneCooldownState(cooldownState: CooldownState): CooldownState {
  return structuredClone(cooldownState)
}

export function cloneBypassState(bypassState: BypassState): BypassState {
  return structuredClone(bypassState)
}

export function cloneLocationState(locationState: LocationState): LocationState {
  return structuredClone(locationState)
}

export function cloneStreakData(streakData: StreakData): StreakData {
  return structuredClone(streakData)
}

export function cloneLicenseCache(licenseCache: LicenseCache): LicenseCache {
  return structuredClone(licenseCache)
}

export function cloneBackgroundState(backgroundState: BackgroundState): BackgroundState {
  return structuredClone(backgroundState)
}
