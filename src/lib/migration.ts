import type {
  GroupRule,
  Location,
  ScreenTimeGoal,
  Settings,
  SiteRule,
  StreakData,
  StreakDayStatus,
  StreakRecord,
} from './types'
import {
  DEFAULT_LOCK_MODE,
  DEFAULT_SCREEN_TIME_GOAL,
  DEFAULT_SETTINGS,
  DEFAULT_STREAK_DATA,
  cloneSettings,
  cloneStreakData,
} from './defaults'
import {
  isBlockRule,
  isCustomQuote,
  isLockModeSettings,
  isLocation,
  isRecord,
  isScreenTimeGoal,
  isStreakDisplayMode,
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
    customQuotes: [],
    screenTimeGoal: structuredClone(DEFAULT_SCREEN_TIME_GOAL),
    lockMode: {
      ...DEFAULT_LOCK_MODE,
      updatedAt: now,
    },
    updatedAt: now,
  }
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
  screenTimeGoal?: unknown
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
      screenTimeGoal: isScreenTimeGoal(source.screenTimeGoal)
        ? structuredClone(source.screenTimeGoal as ScreenTimeGoal)
        : defaults.screenTimeGoal,
      lockMode: isLockModeSettings(source.lockMode)
        ? source.lockMode
        : defaults.lockMode,
      updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : 0,
    }
  }
  if (isLegacySettings(data)) return migrateLegacySettings(data)
  return cloneSettings(DEFAULT_SETTINGS)
}
