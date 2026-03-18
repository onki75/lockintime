// ===== 制限タイプ =====

export type RestrictionType =
  | 'full_block'
  | 'time_of_day'
  | 'daily_count'
  | 'daily_duration'
  | 'cooldown'
  | 'delay'
  | 'location'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DaySchedule {
  days: DayOfWeek[]
  startTime: string // "09:00"
  endTime: string // "18:00"
}

export type RestrictionConfig =
  | { type: 'full_block' }
  | { type: 'time_of_day'; schedule: DaySchedule[] }
  | { type: 'daily_count'; maxCount: number }
  | { type: 'daily_duration'; maxMinutes: number }
  | { type: 'cooldown'; cooldownMinutes: number }
  | { type: 'delay'; delaySeconds: number }
  | { type: 'location'; locationIds: string[] }

// ===== ブロックルール =====

export interface SiteRule {
  id: string
  type: 'site'
  url: string
  enabled: boolean
  restrictions: RestrictionConfig[]
  createdAt: number
  updatedAt: number
}

export interface GroupRule {
  id: string
  type: 'group'
  name: string
  urls: string[]
  enabled: boolean
  restrictions: RestrictionConfig[]
  preset: boolean
  createdAt: number
  updatedAt: number
}

export type BlockRule = SiteRule | GroupRule

// ===== 場所 =====

export interface Location {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  updatedAt?: number
}

// ===== ランタイム状態 =====

export interface DailyStats {
  date: string // ローカル日付 "2026-03-16"
  counts: Record<string, number>
  durations: Record<string, number>
}

export type ChallengeTier = 'bronze' | 'silver' | 'gold'

export type ChallengeType =
  | 'no_bypass'
  | 'zero_access'
  | 'all_rules_kept'
  | 'under_half_limit'
  | 'no_count_access'

export interface DailyChallenge {
  id: string
  date: string // "2026-03-19"
  tier: ChallengeTier
  type: ChallengeType
  description: string
  target: number
  current: number
  completed: boolean
  completedAt: number | null
}

export interface DailyChallengeState {
  challenges: DailyChallenge[]
  lastGeneratedDate: string
}

export interface CooldownState {
  lastAccess: Record<string, number>
}

export interface BypassEntry {
  ruleId: string
  expiresAt: number
  createdAt: number
}

export interface BypassState {
  entries: BypassEntry[]
}

export interface LocationState {
  activeLocationIds: string[]
  lastCheckedAt: number | null
  lastError: string | null
}

// ===== ストリーク =====

export const STREAK_DAY_STATUSES = ['success', 'bypass', 'repaired', 'failure'] as const

export type StreakDayStatus = typeof STREAK_DAY_STATUSES[number]

export interface StreakRecord {
  date: string
  success: boolean
  status: StreakDayStatus
}

export interface StreakData {
  perRule: Record<string, StreakRecord[]>
  global: StreakRecord[]
  updatedAt: number
}

export type StreakDisplayMode = 'heatmap' | 'number'
export type UIMode = 'mascot' | 'simple'

export interface RescuePass {
  available: number
  frozenCount: number
  frozenMax: number
  totalEarned: number
  totalUsedBypass: number
  totalUsedFreeze: number
  totalUsedFeed: number
}

export interface MascotState {
  level: number
  feedCount: number
  lastFedAt: number | null
}

export interface CustomQuote {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

export type LockModeLevel = 'off' | 'soft' | 'hard' | 'nuclear'

export interface LockModeSettings {
  enabled: boolean
  level: LockModeLevel
  passwordHash: string | null
  passwordSalt?: string | null
  challengeText?: string | null
  nuclearUntil?: number | null
  delayUnlockUntil?: number | null
  updatedAt: number
}

export type LicensePlan = 'free' | 'pro' | 'cloud'

export interface LicenseCache {
  plan: LicensePlan
  lastVerified: number | null
  source: 'default' | 'local' | 'cloud'
  expiresAt: number | null
}

export interface AuthUser {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
}

export interface AuthState {
  status: 'anonymous' | 'authenticated' | 'error'
  user: AuthUser | null
  lastError: string | null
}

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  lastError: string | null
  pendingPush: boolean
  isApplyingRemote: boolean
}

export interface DeletedMap {
  blockRules: Record<string, number>
  locations: Record<string, number>
  customQuotes: Record<string, number>
  dailyStats: Record<string, number>
}

// ===== アプリ設定 =====

export interface Settings {
  blockRules: BlockRule[]
  adultFilter: boolean
  locations: Location[]
  streakDisplayMode: StreakDisplayMode
  uiMode: UIMode
  customQuotes: CustomQuote[]
  lockMode: LockModeSettings
  updatedAt: number
}

export interface BackgroundState {
  trialStartDate?: number
  dailyStats: DailyStats | null
  dailyStatsHistory: Record<string, DailyStats>
  cooldownState: CooldownState
  bypassState: BypassState
  locationState: LocationState
  streakData: StreakData
  syncState: SyncState
  authState: AuthState
  licenseCache: LicenseCache
}
