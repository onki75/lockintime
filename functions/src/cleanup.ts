import { shouldDeleteCloudData, type CleanupCandidate } from './license'

export type CleanupPath =
  | 'dailyStats'
  | 'streak/data'
  | 'runtime/cooldown'
  | 'meta/sync'
  | 'tombstones/current'

export type CleanupPlan = {
  shouldDelete: boolean
  paths: CleanupPath[]
}

const CLOUD_CLEANUP_PATHS: CleanupPath[] = [
  'dailyStats',
  'streak/data',
  'runtime/cooldown',
  'meta/sync',
  'tombstones/current',
]

export function buildCleanupPlan(
  candidate: CleanupCandidate,
  now = Date.now(),
): CleanupPlan {
  if (!shouldDeleteCloudData(candidate, now)) {
    return {
      shouldDelete: false,
      paths: [],
    }
  }

  return {
    shouldDelete: true,
    paths: [...CLOUD_CLEANUP_PATHS],
  }
}

export function toUserDocumentPaths(
  userId: string,
  cleanupPlan: CleanupPlan,
): string[] {
  return cleanupPlan.paths.map((path) => `users/${userId}/${path}`)
}
