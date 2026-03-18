import type {
  AuthState,
  BackgroundState,
  BypassState,
  CooldownState,
  DailyStats,
  DeletedMap,
  LicenseCache,
  LocationState,
  LockModeSettings,
  MascotState,
  RescuePass,
  Settings,
  StreakData,
  SyncState,
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

export const DEFAULT_SETTINGS: Settings = {
  blockRules: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
  uiMode: 'mascot',
  customQuotes: [],
  lockMode: structuredClone(DEFAULT_LOCK_MODE),
  updatedAt: 0,
}

export const DEFAULT_RESCUE_PASS: RescuePass = {
  available: 0,
  totalEarned: 0,
  totalUsed: 0,
  totalFed: 0,
}

export const DEFAULT_MASCOT_STATE: MascotState = {
  level: 0,
  feedCount: 0,
  lastFedAt: null,
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

export const DEFAULT_DELETED_MAP: DeletedMap = {
  blockRules: {},
  locations: {},
  customQuotes: {},
  dailyStats: {},
}

export const DEFAULT_SYNC_STATE: SyncState = {
  status: 'disabled',
  lastSyncedAt: null,
  lastError: null,
  pendingPush: false,
  isApplyingRemote: false,
}

export const DEFAULT_AUTH_STATE: AuthState = {
  status: 'anonymous',
  user: null,
  lastError: null,
}

export const DEFAULT_LICENSE_CACHE: LicenseCache = {
  plan: 'free',
  lastVerified: null,
  source: 'default',
  expiresAt: null,
}

export const DEFAULT_BACKGROUND_STATE: BackgroundState = {
  dailyStats: null,
  dailyStatsHistory: {},
  cooldownState: structuredClone(DEFAULT_COOLDOWN_STATE),
  bypassState: structuredClone(DEFAULT_BYPASS_STATE),
  locationState: structuredClone(DEFAULT_LOCATION_STATE),
  streakData: structuredClone(DEFAULT_STREAK_DATA),
  syncState: structuredClone(DEFAULT_SYNC_STATE),
  authState: structuredClone(DEFAULT_AUTH_STATE),
  licenseCache: structuredClone(DEFAULT_LICENSE_CACHE),
}

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

export function cloneDeletedMap(deletedMap: DeletedMap): DeletedMap {
  return structuredClone(deletedMap)
}

export function cloneStreakData(streakData: StreakData): StreakData {
  return structuredClone(streakData)
}

export function cloneSyncState(syncState: SyncState): SyncState {
  return structuredClone(syncState)
}

export function cloneAuthState(authState: AuthState): AuthState {
  return structuredClone(authState)
}

export function cloneLicenseCache(licenseCache: LicenseCache): LicenseCache {
  return structuredClone(licenseCache)
}

export function cloneBackgroundState(backgroundState: BackgroundState): BackgroundState {
  return structuredClone(backgroundState)
}

export function cloneRescuePass(pass: RescuePass): RescuePass {
  return structuredClone(pass)
}

export function cloneMascotState(state: MascotState): MascotState {
  return structuredClone(state)
}
