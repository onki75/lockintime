import type {
  DailyStats,
  DeletedMap,
  LicensePlan,
  Settings,
  StreakData,
} from './types'

export interface CloudDocument<T> {
  data: T
  updatedAt: number
  updatedBy: string | null
  version: number
}

export interface CloudSettingsData extends Pick<
  Settings,
  'blockRules' | 'adultFilter' | 'locations' | 'streakDisplayMode' | 'uiMode' | 'customQuotes' | 'lockMode'
> {
  updatedAt: number
}

export type CloudSettingsDocument = CloudDocument<CloudSettingsData>
export type CloudStreakDocument = CloudDocument<StreakData>
export type CloudDailyStatsDocument = CloudDocument<DailyStats>

export interface CloudLicenseDocument {
  plan: LicensePlan
  lastVerified: number
  updatedAt: number
  updatedBy: string | null
}

export interface CloudSyncMetaDocument {
  lastPulledAt: number | null
  lastPushedAt: number | null
  lastError: string | null
}

export interface CloudTombstonesDocument {
  deleted: DeletedMap
  updatedAt: number
}

export type SyncPayload = {
  settings: CloudSettingsDocument
  streak: CloudStreakDocument
  dailyStats: Record<string, CloudDailyStatsDocument>
  meta: CloudSyncMetaDocument
  tombstones: CloudTombstonesDocument
}

export function createCloudDocument<T>(
  data: T,
  updatedAt: number,
  updatedBy: string | null,
  version = 1,
): CloudDocument<T> {
  return {
    data,
    updatedAt,
    updatedBy,
    version,
  }
}

export function createEmptyDeletedMap(): DeletedMap {
  return {
    blockRules: {},
    locations: {},
    customQuotes: {},
    dailyStats: {},
  }
}
