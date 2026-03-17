import { getSettings, saveSettings } from './storage'
import type {
  Settings,
} from './types'
import { canMigrateSettingsData, migrateSettings } from './migration'
import { isRecord, isSettings } from './validation'

const EXPORT_VERSION = 1

type ExportPayload = {
  version: number
  exportedAt: string
  settings: unknown
}

export function validateSettings(data: unknown): data is Settings {
  return isSettings(data)
}

function validateExportPayload(data: unknown): data is ExportPayload {
  if (!isRecord(data)) return false

  return (
    data.version === EXPORT_VERSION &&
    typeof data.exportedAt === 'string' &&
    !Number.isNaN(Date.parse(data.exportedAt))
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

  if (!canMigrateSettingsData(parsed.settings)) {
    throw new Error('Invalid export data')
  }

  await saveSettings(migrateSettings(parsed.settings))
}
