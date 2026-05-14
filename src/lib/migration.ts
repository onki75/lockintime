import type {
  BlockRule,
  GroupRule,
  Location,
  RestrictionConfig,
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
  getDefaultFreeActiveRuleIds,
  normalizeFreeActiveRuleIds,
} from './rule-activation'
import {
  isBlockRule,
  isCustomQuote,
  isLockModeSettings,
  isLocation,
  isRecord,
  isScreenTimeGoal,
  isStreakDisplayMode,
  normalizeRulePattern,
} from './validation'

type LegacyBlockRule = {
  id: string
  url: string
  enabled: boolean
}

type LegacySettings = {
  blockRules: unknown[]
  focusMode: boolean
  focusDuration: number
}

type MigratableSiteRule = SiteRule & { enabled?: boolean }
type MigratableGroupRule = GroupRule & { enabled?: boolean }

type CurrentSettingsSource = {
  blockRules?: unknown
  freeActiveRuleIds?: unknown
  adultFilter?: unknown
  locations?: unknown
  streakDisplayMode?: unknown
  uiMode?: unknown
  customQuotes?: unknown
  screenTimeGoal?: unknown
  lockMode?: unknown
  updatedAt?: unknown
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
    normalizeRulePattern(value.url) !== null &&
    typeof value.enabled === 'boolean'
  )
}

function isLegacySettings(value: unknown): value is LegacySettings {
  return (
    isRecord(value) &&
    Array.isArray(value.blockRules) &&
    value.blockRules.some(isLegacyBlockRule) &&
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
  const sourceBlockRules = settings.blockRules.filter(isLegacyBlockRule)
  const blockRules: Settings['blockRules'] = sourceBlockRules
    .map((rule) => ({
      id: rule.id,
      type: 'site' as const,
      url: normalizeRulePattern(rule.url) ?? rule.url,
      restrictions: [{ type: 'full_block' as const }],
      createdAt: now,
      updatedAt: now,
    }))

  const hasDisabledRule = sourceBlockRules.some((rule) => rule.enabled === false)

  return {
    blockRules,
    freeActiveRuleIds: hasDisabledRule
      ? normalizeFreeActiveRuleIds(
        blockRules,
        sourceBlockRules.filter((rule) => rule.enabled).map((rule) => rule.id),
      )
      : getDefaultFreeActiveRuleIds(blockRules),
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

function canMigrateCurrentSettings(value: unknown): value is CurrentSettingsSource {
  if (!isRecord(value)) return false

  return (
    Array.isArray(value.blockRules) ||
    Array.isArray(value.freeActiveRuleIds) ||
    typeof value.adultFilter === 'boolean' ||
    Array.isArray(value.locations) ||
    isStreakDisplayMode(value.streakDisplayMode) ||
    Array.isArray(value.customQuotes) ||
    isScreenTimeGoal(value.screenTimeGoal) ||
    isLockModeSettings(value.lockMode) ||
    typeof value.updatedAt === 'number'
  )
}

function canMigrateCompleteCurrentSettings(value: unknown): value is {
  blockRules: MigratableSiteRule[] | MigratableGroupRule[]
  freeActiveRuleIds?: unknown
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

function getLegacyFreeActiveRuleIds(
  source: { blockRules: unknown[] },
  blockRules: Settings['blockRules'],
): string[] | null {
  const legacyEntries = source.blockRules
    .filter(isRecord)
    .map((rule) => ({
      id: typeof rule.id === 'string' ? rule.id : null,
      enabled: typeof rule.enabled === 'boolean' ? rule.enabled : null,
    }))
    .filter((rule): rule is { id: string; enabled: boolean } => rule.id !== null && rule.enabled !== null)

  if (legacyEntries.length === 0) {
    return null
  }

  if (legacyEntries.every((rule) => rule.enabled)) {
    return getDefaultFreeActiveRuleIds(blockRules)
  }

  return normalizeFreeActiveRuleIds(
    blockRules,
    legacyEntries.filter((rule) => rule.enabled).map((rule) => rule.id),
  )
}

function migrateRestriction(restriction: RestrictionConfig): RestrictionConfig {
  if (restriction.type !== 'daily_count') {
    return restriction
  }

  const value = (restriction as { perSessionMinutes?: number | null }).perSessionMinutes
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return restriction
  }

  return { ...restriction, perSessionMinutes: 10 }
}

function migrateBlockRule(rule: MigratableSiteRule | MigratableGroupRule): BlockRule {
  const restrictions = rule.restrictions.map(migrateRestriction)
  return rule.type === 'site'
    ? {
      id: rule.id,
      type: 'site',
      url: normalizeRulePattern(rule.url) ?? rule.url,
      restrictions,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }
    : {
      id: rule.id,
      type: 'group',
      name: rule.name,
      urls: [...new Set(rule.urls.map(normalizeRulePattern).filter((url): url is string => url !== null))],
      restrictions,
      preset: rule.preset,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }
}

function migrateCurrentSettings(source: CurrentSettingsSource): Settings {
  const defaults = cloneSettings(DEFAULT_SETTINGS)
  const sourceBlockRules = Array.isArray(source.blockRules) ? source.blockRules : []
  const blockRules = sourceBlockRules
    .filter(isBlockRule)
    .map((rule) => migrateBlockRule(rule))
  const legacyFreeActiveRuleIds = getLegacyFreeActiveRuleIds(
    { blockRules: sourceBlockRules },
    blockRules,
  )
  const freeActiveRuleIds = Array.isArray(source.freeActiveRuleIds)
    ? normalizeFreeActiveRuleIds(blockRules, source.freeActiveRuleIds.filter((id): id is string => typeof id === 'string'))
    : legacyFreeActiveRuleIds ?? getDefaultFreeActiveRuleIds(blockRules)
  const locations = Array.isArray(source.locations)
    ? source.locations
      .filter(isLocation)
      .map((location) => ({
        ...location,
        updatedAt: location.updatedAt ?? 0,
      }))
    : defaults.locations

  return {
    blockRules,
    freeActiveRuleIds,
    adultFilter: typeof source.adultFilter === 'boolean'
      ? source.adultFilter
      : defaults.adultFilter,
    locations,
    streakDisplayMode: isStreakDisplayMode(source.streakDisplayMode)
      ? source.streakDisplayMode
      : defaults.streakDisplayMode,
    customQuotes: Array.isArray(source.customQuotes)
      ? source.customQuotes.filter(isCustomQuote)
      : defaults.customQuotes,
    screenTimeGoal: isScreenTimeGoal(source.screenTimeGoal)
      ? structuredClone(source.screenTimeGoal as ScreenTimeGoal)
      : defaults.screenTimeGoal,
    lockMode: isLockModeSettings(source.lockMode)
      ? source.lockMode
      : defaults.lockMode,
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : defaults.updatedAt,
  }
}

export function canMigrateSettingsData(value: unknown): boolean {
  return canMigrateCompleteCurrentSettings(value) || isLegacySettings(value)
}

export function migrateSettings(data: unknown): Settings {
  if (isLegacySettings(data)) return migrateLegacySettings(data)
  if (canMigrateCurrentSettings(data)) {
    return migrateCurrentSettings(data)
  }
  return cloneSettings(DEFAULT_SETTINGS)
}
