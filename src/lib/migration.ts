import type {
  GroupRule,
  Location,
  Settings,
  SiteRule,
} from './types'
import { DEFAULT_LOCK_MODE, DEFAULT_SETTINGS, cloneSettings } from './defaults'
import {
  isBlockRule,
  isCustomQuote,
  isLockModeSettings,
  isLocation,
  isRecord,
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
    customQuotes: [],
    lockMode: {
      ...DEFAULT_LOCK_MODE,
      updatedAt: now,
    },
    updatedAt: now,
  }
}

function canMigrateCurrentSettings(value: unknown): value is {
  blockRules: SiteRule[] | GroupRule[]
  adultFilter: boolean
  locations: Location[]
  streakDisplayMode: Settings['streakDisplayMode']
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
      lockMode: isLockModeSettings(source.lockMode)
        ? source.lockMode
        : defaults.lockMode,
      updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : 0,
    }
  }
  if (isLegacySettings(data)) return migrateLegacySettings(data)
  return cloneSettings(DEFAULT_SETTINGS)
}
