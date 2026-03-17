import { getSettings, saveSettings } from './storage'
import type {
  BlockRule,
  DaySchedule,
  GroupRule,
  Location,
  RestrictionConfig,
  Settings,
  SiteRule,
} from './types'

const EXPORT_VERSION = 1

type ExportPayload = {
  version: number
  exportedAt: string
  settings: Settings
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDayOfWeek(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

function isDaySchedule(value: unknown): value is DaySchedule {
  if (!isObject(value)) return false

  const days = value.days

  return (
    Array.isArray(days) &&
    days.every(isDayOfWeek) &&
    typeof value.startTime === 'string' &&
    typeof value.endTime === 'string'
  )
}

function isRestrictionConfig(value: unknown): value is RestrictionConfig {
  if (!isObject(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'full_block':
      return true
    case 'time_of_day':
      return Array.isArray(value.schedule) && value.schedule.every(isDaySchedule)
    case 'daily_count':
      return typeof value.maxCount === 'number'
    case 'daily_duration':
      return typeof value.maxMinutes === 'number'
    case 'cooldown':
      return typeof value.cooldownMinutes === 'number'
    case 'delay':
      return typeof value.delaySeconds === 'number'
    case 'location':
      return Array.isArray(value.locationIds) && value.locationIds.every((id) => typeof id === 'string')
    default:
      return false
  }
}

function hasBaseRuleFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.restrictions) &&
    value.restrictions.every(isRestrictionConfig) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

function isSiteRule(value: unknown): value is SiteRule {
  if (!isObject(value) || value.type !== 'site' || !hasBaseRuleFields(value)) {
    return false
  }

  return typeof value.url === 'string'
}

function isGroupRule(value: unknown): value is GroupRule {
  if (!isObject(value) || value.type !== 'group' || !hasBaseRuleFields(value)) {
    return false
  }

  return (
    typeof value.name === 'string' &&
    Array.isArray(value.urls) &&
    value.urls.every((url) => typeof url === 'string') &&
    typeof value.preset === 'boolean'
  )
}

function isBlockRule(value: unknown): value is BlockRule {
  return isSiteRule(value) || isGroupRule(value)
}

function isLocation(value: unknown): value is Location {
  if (!isObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.radiusMeters === 'number'
  )
}

export function validateSettings(data: unknown): data is Settings {
  if (!isObject(data)) return false

  return (
    Array.isArray(data.blockRules) &&
    data.blockRules.every(isBlockRule) &&
    typeof data.adultFilter === 'boolean' &&
    Array.isArray(data.locations) &&
    data.locations.every(isLocation) &&
    (data.streakDisplayMode === 'heatmap' || data.streakDisplayMode === 'number')
  )
}

function validateExportPayload(data: unknown): data is ExportPayload {
  if (!isObject(data)) return false

  return (
    data.version === EXPORT_VERSION &&
    typeof data.exportedAt === 'string' &&
    !Number.isNaN(Date.parse(data.exportedAt)) &&
    validateSettings(data.settings)
  )
}

export async function exportSettings(): Promise<string> {
  const settings = await getSettings()
  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  }

  return JSON.stringify(payload, null, 2)
}

export async function importSettings(json: string): Promise<void> {
  let parsed: unknown

  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid export data')
  }

  if (!validateExportPayload(parsed)) {
    throw new Error('Invalid export data')
  }

  await saveSettings(parsed.settings)
}
