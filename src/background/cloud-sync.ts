import type { AuthState, DailyStats } from '../lib/types'
import { DEFAULT_SYNC_STATE } from '../lib/defaults'
import {
  getBackgroundState,
  getDeletedMap,
  getSettings,
  getSyncState,
  saveAuthState,
  saveBackgroundState,
  saveSettings,
  saveSyncState,
} from '../lib/storage'
import { createSyncService, createFirestoreSyncRemoteAdapter, type LocalSyncSnapshot } from '../lib/sync'
import { hasCloudSyncAccess } from '../lib/license'

let activeSyncService:
  | ReturnType<typeof createSyncService>
  | null = null
let activeSyncUserId: string | null = null

function getLatestDailyStats(
  dailyStatsHistory: Record<string, DailyStats>,
): DailyStats | null {
  const dates = [...Object.keys(dailyStatsHistory)].sort()
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : undefined
  return latestDate ? dailyStatsHistory[latestDate] : null
}

async function loadLocalSyncSnapshot(): Promise<LocalSyncSnapshot> {
  const [settings, backgroundState, deletedMap] = await Promise.all([
    getSettings(),
    getBackgroundState(),
    getDeletedMap(),
  ])

  return {
    settings,
    streakData: backgroundState.streakData,
    dailyStatsHistory: backgroundState.dailyStatsHistory,
    cooldownState: backgroundState.cooldownState,
    deletedMap,
  }
}

async function saveMergedSyncSnapshot(snapshot: LocalSyncSnapshot): Promise<void> {
  const backgroundState = await getBackgroundState()

  await saveSettings(snapshot.settings)
  await chrome.storage.local.set({ deletedMap: snapshot.deletedMap })
  await saveBackgroundState({
    ...backgroundState,
    dailyStats: getLatestDailyStats(snapshot.dailyStatsHistory),
    dailyStatsHistory: snapshot.dailyStatsHistory,
    cooldownState: snapshot.cooldownState,
    streakData: snapshot.streakData,
  })
}

async function updateStoredSyncState(
  syncState: Awaited<ReturnType<typeof getSyncState>>,
): Promise<void> {
  await saveSyncState(syncState)
}

export async function triggerCloudSyncIfActive(): Promise<void> {
  if (!activeSyncService) {
    return
  }

  const syncState = await getSyncState()
  if (syncState.isApplyingRemote) {
    return
  }

  await activeSyncService.forceSync()
}

export async function stopCloudSync(): Promise<void> {
  activeSyncService?.stop()
  activeSyncService = null
  activeSyncUserId = null
  await updateStoredSyncState({
    ...DEFAULT_SYNC_STATE,
    status: 'disabled',
  })
}

async function startCloudSync(userId: string): Promise<void> {
  if (activeSyncService && activeSyncUserId === userId) {
    return
  }

  await stopCloudSync()

  const remote = createFirestoreSyncRemoteAdapter()
  if (!remote) {
    return
  }

  activeSyncUserId = userId
  activeSyncService = createSyncService({
    userId,
    remote,
    loadLocalSnapshot: loadLocalSyncSnapshot,
    saveMergedSnapshot: saveMergedSyncSnapshot,
    updateSyncState: updateStoredSyncState,
  })

  await activeSyncService.start()
}

export async function reconcileCloudSync(authState: AuthState): Promise<void> {
  if (authState.status !== 'authenticated' || !authState.user) {
    await stopCloudSync()
    return
  }

  if (!(await hasCloudSyncAccess())) {
    await stopCloudSync()
    return
  }

  await startCloudSync(authState.user.uid)
}

export async function handleObservedAuthState(authState: AuthState): Promise<void> {
  await saveAuthState(authState)
  await reconcileCloudSync(authState)
}

export function getActiveSyncService() {
  return activeSyncService
}

export async function forceSyncIfActive(): Promise<{ ok: boolean; status?: string }> {
  if (!activeSyncService) {
    return { ok: false, status: 'disabled' }
  }

  await activeSyncService.forceSync()
  return { ok: true }
}
