import type {
  GroupRule,
  Location,
  RescuePass,
  Settings,
  SiteRule,
  StreakData,
  StreakDayStatus,
  StreakRecord,
} from './types'
import {
  DEFAULT_LOCK_MODE,
  DEFAULT_RESCUE_PASS,
  DEFAULT_SETTINGS,
  DEFAULT_STREAK_DATA,
  cloneRescuePass,
  cloneSettings,
  cloneStreakData,
} from './defaults'
import {
  isBlockRule,
  isCustomQuote,
  isLockModeSettings,
  isLocation,
  isRecord,
  isRescuePass,
  isStreakDisplayMode,
  isUIMode,
} from './validation'

type LegacyBlockRule = {
  id: string
  url: string
  enabled: boolean
}

type LegacySettings = {
  blockRules: LegacyBlockRule[]
  focusMode: boolean
  focusDuration: number
}

type LegacyRescuePass = {
  available: number
  totalEarned: number
  totalUsed: number
  totalFed: number
}

type MigratableStreakRecord = {
  date: string
  success: boolean
  status?: unknown
}

function isLegacyBlockRule(value: unknown): value is LegacyBlockRule {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.url === 'string' &&
    typeof value.enabled === 'boolean'
  )
}

function isLegacySettings(value: unknown): value is LegacySettings {
  return (
    isRecord(value) &&
    Array.isArray(value.blockRules) &&
    value.blockRules.every(isLegacyBlockRule) &&
    typeof value.focusMode === 'boolean' &&
    typeof value.focusDuration === 'number'
  )
}

function isLegacyRescuePass(value: unknown): value is LegacyRescuePass {
  return (
    isRecord(value) &&
    typeof value.available === 'number' &&
    typeof value.totalEarned === 'number' &&
    typeof value.totalUsed === 'number' &&
    typeof value.totalFed === 'number'
  )
}

function isMigratableStreakRecord(value: unknown): value is MigratableStreakRecord {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.success === 'boolean'
  )
}

function canMigrateCurrentStreakData(value: unknown): value is {
  perRule: Record<string, unknown>
  global: unknown[]
  updatedAt?: unknown
} {
  return (
    isRecord(value) &&
    isRecord(value.perRule) &&
    Object.values(value.perRule).every(
      (records) => Array.isArray(records) && records.every(isMigratableStreakRecord),
    ) &&
    Array.isArray(value.global) &&
    value.global.every(isMigratableStreakRecord)
  )
}

function inferStreakDayStatus(success: boolean): StreakDayStatus {
  return success ? 'success' : 'failure'
}

function isCompatibleStreakStatus(
  status: unknown,
  success: boolean,
): status is StreakDayStatus {
  return (
    (status === 'success' || status === 'bypass' || status === 'repaired' || status === 'failure') &&
    success === (status !== 'failure')
  )
}

function migrateStreakRecord(record: MigratableStreakRecord): StreakRecord {
  return {
    date: record.date,
    success: record.success,
    status: isCompatibleStreakStatus(record.status, record.success)
      ? record.status
      : inferStreakDayStatus(record.success),
  }
}

function migrateLegacySettings(settings: LegacySettings): Settings {
  const now = Date.now()

  return {
    blockRules: settings.blockRules.map((rule) => ({
      id: rule.id,
      type: 'site',
      url: rule.url,
      enabled: rule.enabled,
      restrictions: [{ type: 'full_block' }],
      createdAt: now,
      updatedAt: now,
    })),
    adultFilter: false,
    locations: [],
    streakDisplayMode: 'number',
    uiMode: 'mascot',
    customQuotes: [],
    lockMode: {
      ...DEFAULT_LOCK_MODE,
      updatedAt: now,
    },
    updatedAt: now,
  }
}

export function canMigrateRescuePassData(value: unknown): boolean {
  return isRescuePass(value) || isLegacyRescuePass(value)
}

export function migrateRescuePass(data: unknown): RescuePass {
  if (isRescuePass(data)) {
    return cloneRescuePass(data)
  }

  if (isLegacyRescuePass(data)) {
    return {
      ...cloneRescuePass(DEFAULT_RESCUE_PASS),
      available: data.available,
      totalEarned: data.totalEarned,
      totalUsedBypass: data.totalUsed,
      totalUsedFeed: data.totalFed,
    }
  }

  return cloneRescuePass(DEFAULT_RESCUE_PASS)
}

export function canMigrateStreakData(value: unknown): boolean {
  return canMigrateCurrentStreakData(value)
}

export function migrateStreakData(data: unknown): StreakData {
  if (!canMigrateCurrentStreakData(data)) {
    return cloneStreakData(DEFAULT_STREAK_DATA)
  }

  const source = data

  return {
    perRule: Object.fromEntries(
      Object.entries(source.perRule).map(([ruleId, records]) => [
        ruleId,
        (records as MigratableStreakRecord[]).map(migrateStreakRecord),
      ]),
    ),
    global: source.global.map((record) => migrateStreakRecord(record as MigratableStreakRecord)),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : 0,
  }
}

function canMigrateCurrentSettings(value: unknown): value is {
  blockRules: SiteRule[] | GroupRule[]
  adultFilter: boolean
  locations: Location[]
  streakDisplayMode: Settings['streakDisplayMode']
  uiMode?: unknown
  customQuotes?: unknown[]
  lockMode?: unknown
  updatedAt?: unknown
} {
  return (
    isRecord(value) &&
    Array.isArray(value.blockRules) &&
    value.blockRules.every(isBlockRule) &&
    typeof value.adultFilter === 'boolean' &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocation) &&
    isStreakDisplayMode(value.streakDisplayMode)
  )
}

export function canMigrateSettingsData(value: unknown): boolean {
  return canMigrateCurrentSettings(value) || isLegacySettings(value)
}

export function migrateSettings(data: unknown): Settings {
  if (canMigrateCurrentSettings(data)) {
    const source = data
    const defaults = cloneSettings(DEFAULT_SETTINGS)
    const uiMode = isUIMode(source.uiMode) ? source.uiMode : 'mascot'

    return {
      ...defaults,
      ...source,
      locations: source.locations.map((location) => ({
        ...location,
        updatedAt: location.updatedAt ?? 0,
      })),
      customQuotes: Array.isArray(source.customQuotes)
        ? source.customQuotes.filter(isCustomQuote)
        : [],
      uiMode,
      lockMode: isLockModeSettings(source.lockMode)
        ? source.lockMode
        : defaults.lockMode,
      updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : 0,
    }
  }
  if (isLegacySettings(data)) return migrateLegacySettings(data)
  return cloneSettings(DEFAULT_SETTINGS)
}
