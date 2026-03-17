import type {
  GroupRule,
  Location,
  RestrictionConfig,
  Settings,
  SiteRule,
  StreakDisplayMode,
} from './types'

const DEFAULT_SETTINGS: Settings = {
  blockRules: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
}

type UnknownRecord = Record<string, unknown>

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

function cloneDefaultSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS)
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isDayOfWeek(value: unknown): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 6
}

function isRestrictionConfig(value: unknown): value is RestrictionConfig {
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

function isLocation(value: unknown): value is Location {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.radiusMeters === 'number'
  )
}

function isSiteRule(value: unknown): value is SiteRule {
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

function isGroupRule(value: unknown): value is GroupRule {
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

function isStreakDisplayMode(value: unknown): value is StreakDisplayMode {
  return value === 'number' || value === 'heatmap'
}

function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    Array.isArray(value.blockRules) &&
    value.blockRules.every((rule) => isSiteRule(rule) || isGroupRule(rule)) &&
    typeof value.adultFilter === 'boolean' &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocation) &&
    isStreakDisplayMode(value.streakDisplayMode)
  )
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
  }
}

export function migrateSettings(data: unknown): Settings {
  if (isSettings(data)) return data
  if (isLegacySettings(data)) return migrateLegacySettings(data)
  return cloneDefaultSettings()
}
