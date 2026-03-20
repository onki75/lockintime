import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import type {
  BlockRule,
  CooldownState,
  CustomQuote,
  DailyStats,
  DeletedMap,
  Location,
  Settings,
  StreakData,
  StreakDayStatus,
  StreakRecord,
  SyncState,
} from './types'
import {
  createCloudDocument,
  createEmptyDeletedMap,
  type CloudDailyStatsDocument,
  type CloudTombstonesDocument,
} from './cloud-types'
import { getFirebaseFirestore } from './firebase'
import { mergeLockModeSecrets, sanitizeLockModeForCloud } from './lock'
import { migrateStreakData } from './migration'

export type LocalSyncSnapshot = {
  settings: Settings
  streakData: StreakData
  dailyStatsHistory: Record<string, DailyStats>
  cooldownState: CooldownState
  deletedMap: DeletedMap
}

export type SyncRemoteAdapter = {
  pull: (userId: string) => Promise<LocalSyncSnapshot | null>
  push: (userId: string, snapshot: LocalSyncSnapshot) => Promise<void>
  subscribe: (
    userId: string,
    listener: (snapshot: LocalSyncSnapshot) => void | Promise<void>,
    onError?: (error: unknown) => void | Promise<void>,
  ) => () => void
}

type SyncServiceDependencies = {
  userId: string
  remote: SyncRemoteAdapter
  loadLocalSnapshot: () => Promise<LocalSyncSnapshot>
  saveMergedSnapshot: (snapshot: LocalSyncSnapshot) => Promise<void>
  updateSyncState: (state: SyncState) => Promise<void>
  now?: () => number
}

type MergeableEntity = {
  id: string
  updatedAt?: number
}

function getStreakRecordStatus(record: Pick<StreakRecord, 'success'> & Partial<Pick<StreakRecord, 'status'>>): StreakDayStatus {
  return record.status ?? (record.success ? 'success' : 'failure')
}

function mergeStreakStatuses(left: StreakRecord, right: StreakRecord): StreakDayStatus {
  const statuses = [getStreakRecordStatus(left), getStreakRecordStatus(right)]

  if (statuses.includes('failure')) {
    return 'failure'
  }

  if (statuses.includes('repaired')) {
    return 'repaired'
  }

  if (statuses.includes('bypass')) {
    return 'bypass'
  }

  return 'success'
}

function mergeNumberMaps(
  local: Record<string, number>,
  remote: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const merged: Record<string, number> = {}

  for (const key of keys) {
    merged[key] = (local[key] ?? 0) + (remote[key] ?? 0)
  }

  return merged
}

function mergeDeletedMaps(local: DeletedMap, remote: DeletedMap): DeletedMap {
  const mergeSection = (
    left: Record<string, number>,
    right: Record<string, number>,
  ): Record<string, number> => {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    const merged: Record<string, number> = {}

    for (const key of keys) {
      merged[key] = Math.max(left[key] ?? 0, right[key] ?? 0)
    }

    return merged
  }

  return {
    blockRules: mergeSection(local.blockRules, remote.blockRules),
    locations: mergeSection(local.locations, remote.locations),
    customQuotes: mergeSection(local.customQuotes, remote.customQuotes),
    dailyStats: mergeSection(local.dailyStats, remote.dailyStats),
  }
}

function mergeEntitiesById<T extends MergeableEntity>(
  local: T[],
  remote: T[],
): T[] {
  const merged = new Map<string, T>()

  for (const entity of [...local, ...remote]) {
    const existing = merged.get(entity.id)
    if (!existing || (entity.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      merged.set(entity.id, entity)
    }
  }

  return [...merged.values()]
}

function applyDeletionMapToEntities<T extends MergeableEntity>(
  entities: T[],
  deletions: Record<string, number>,
): T[] {
  return entities.filter((entity) => {
    const deletedAt = deletions[entity.id]
    if (!deletedAt) {
      return true
    }

    return (entity.updatedAt ?? 0) > deletedAt
  })
}

function mergeStreakRecords(
  local: StreakRecord[],
  remote: StreakRecord[],
): StreakRecord[] {
  const merged = new Map<string, StreakRecord>()

  for (const record of [...local, ...remote]) {
    const existing = merged.get(record.date)
    if (!existing) {
      merged.set(record.date, record)
      continue
    }

    merged.set(record.date, {
      date: record.date,
      success: existing.success && record.success,
      status: mergeStreakStatuses(existing, record),
    })
  }

  return [...merged.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export function mergeDailyStats(
  local: DailyStats,
  remote: DailyStats,
): DailyStats {
  if (local.date !== remote.date) {
    throw new Error('DailyStats date mismatch')
  }

  return {
    date: local.date,
    counts: mergeNumberMaps(local.counts, remote.counts),
    durations: mergeNumberMaps(local.durations, remote.durations),
  }
}

export function mergeDailyStatsHistory(
  local: Record<string, DailyStats>,
  remote: Record<string, DailyStats>,
  deleted: Record<string, number> = {},
): Record<string, DailyStats> {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)])
  const merged: Record<string, DailyStats> = {}

  for (const date of dates) {
    const deletedAt = deleted[date]
    if (deletedAt) {
      continue
    }

    const localStats = local[date]
    const remoteStats = remote[date]

    if (localStats && remoteStats) {
      merged[date] = mergeDailyStats(localStats, remoteStats)
      continue
    }

    merged[date] = localStats ?? remoteStats
  }

  return merged
}

export function mergeStreakData(
  local: StreakData,
  remote: StreakData,
): StreakData {
  const perRuleKeys = new Set([
    ...Object.keys(local.perRule),
    ...Object.keys(remote.perRule),
  ])
  const perRule: Record<string, StreakRecord[]> = {}

  for (const key of perRuleKeys) {
    perRule[key] = mergeStreakRecords(
      local.perRule[key] ?? [],
      remote.perRule[key] ?? [],
    )
  }

  return {
    perRule,
    global: mergeStreakRecords(local.global, remote.global),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

function mergeLocations(local: Location[], remote: Location[]): Location[] {
  return mergeEntitiesById(local, remote)
}

function mergeCustomQuotes(local: CustomQuote[], remote: CustomQuote[]): CustomQuote[] {
  return mergeEntitiesById(local, remote)
}

function mergeBlockRules(local: BlockRule[], remote: BlockRule[]): BlockRule[] {
  return mergeEntitiesById(local, remote)
}

export function mergeSettings(
  local: Settings,
  remote: Settings,
  deletedMap: DeletedMap = createEmptyDeletedMap(),
): Settings {
  const localWins = local.updatedAt >= remote.updatedAt

  return {
    blockRules: applyDeletionMapToEntities(
      mergeBlockRules(local.blockRules, remote.blockRules),
      deletedMap.blockRules,
    ),
    adultFilter: localWins ? local.adultFilter : remote.adultFilter,
    locations: applyDeletionMapToEntities(
      mergeLocations(local.locations, remote.locations),
      deletedMap.locations,
    ),
    streakDisplayMode: localWins ? local.streakDisplayMode : remote.streakDisplayMode,
    uiMode: localWins ? local.uiMode : remote.uiMode,
    customQuotes: applyDeletionMapToEntities(
      mergeCustomQuotes(local.customQuotes, remote.customQuotes),
      deletedMap.customQuotes,
    ),
    screenTimeGoal: localWins ? local.screenTimeGoal : remote.screenTimeGoal,
    lockMode: mergeLockModeSecrets(local.lockMode, remote.lockMode),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

export function mergeCooldownState(
  local: CooldownState,
  remote: CooldownState,
): CooldownState {
  const keys = new Set([
    ...Object.keys(local.lastAccess),
    ...Object.keys(remote.lastAccess),
  ])
  const lastAccess: Record<string, number> = {}

  for (const key of keys) {
    lastAccess[key] = Math.max(local.lastAccess[key] ?? 0, remote.lastAccess[key] ?? 0)
  }

  return { lastAccess }
}

export function mergeSyncSnapshots(
  local: LocalSyncSnapshot,
  remote: LocalSyncSnapshot,
): LocalSyncSnapshot {
  const deletedMap = mergeDeletedMaps(local.deletedMap, remote.deletedMap)

  return {
    settings: mergeSettings(local.settings, remote.settings, deletedMap),
    streakData: mergeStreakData(local.streakData, remote.streakData),
    dailyStatsHistory: mergeDailyStatsHistory(
      local.dailyStatsHistory,
      remote.dailyStatsHistory,
      deletedMap.dailyStats,
    ),
    cooldownState: mergeCooldownState(local.cooldownState, remote.cooldownState),
    deletedMap,
  }
}

export function createSyncService({
  userId,
  remote,
  loadLocalSnapshot,
  saveMergedSnapshot,
  updateSyncState,
  now = () => Date.now(),
}: SyncServiceDependencies) {
  let unsubscribe: (() => void) | null = null

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }

    return String(error)
  }

  async function setSyncState(state: SyncState): Promise<void> {
    await updateSyncState(state)
  }

  async function setErrorState(error: unknown): Promise<void> {
    await setSyncState({
      status: 'error',
      lastSyncedAt: null,
      lastError: getErrorMessage(error),
      pendingPush: false,
      isApplyingRemote: false,
    })
  }

  async function pullAndMerge(): Promise<LocalSyncSnapshot> {
    const [localSnapshot, remoteSnapshot] = await Promise.all([
      loadLocalSnapshot(),
      remote.pull(userId),
    ])

    if (!remoteSnapshot) {
      return localSnapshot
    }

    const merged = mergeSyncSnapshots(localSnapshot, remoteSnapshot)
    await saveMergedSnapshot(merged)
    return merged
  }

  async function setIdleState(): Promise<void> {
    await setSyncState({
      status: 'idle',
      lastSyncedAt: now(),
      lastError: null,
      pendingPush: false,
      isApplyingRemote: false,
    })
  }

  return {
    async start(): Promise<void> {
      try {
        await setSyncState({
          status: 'syncing',
          lastSyncedAt: null,
          lastError: null,
          pendingPush: false,
          isApplyingRemote: false,
        })

        await pullAndMerge()
        unsubscribe = remote.subscribe(
          userId,
          async (snapshot) => {
            try {
              await setSyncState({
                status: 'syncing',
                lastSyncedAt: null,
                lastError: null,
                pendingPush: false,
                isApplyingRemote: true,
              })

              const localSnapshot = await loadLocalSnapshot()
              const merged = mergeSyncSnapshots(localSnapshot, snapshot)
              await saveMergedSnapshot(merged)
              await setIdleState()
            } catch (error) {
              console.error('LockInTime: failed to apply remote sync snapshot', error)
              await setErrorState(error)
            }
          },
          async (error) => {
            console.error('LockInTime: sync subscription failed', error)
            await setErrorState(error)
          },
        )
        await setIdleState()
      } catch (error) {
        await setErrorState(error)
        throw error
      }
    },

    async forceSync(): Promise<void> {
      try {
        await setSyncState({
          status: 'syncing',
          lastSyncedAt: null,
          lastError: null,
          pendingPush: true,
          isApplyingRemote: false,
        })

        const merged = await pullAndMerge()
        await remote.push(userId, merged)
        await setIdleState()
      } catch (error) {
        await setErrorState(error)
        throw error
      }
    },

    stop(): void {
      unsubscribe?.()
      unsubscribe = null
      void setSyncState({
        status: 'disabled',
        lastSyncedAt: null,
        lastError: null,
        pendingPush: false,
        isApplyingRemote: false,
      }).catch(console.error)
    },
  }
}

function getUserDocPath(userId: string, ...segments: string[]): string {
  return ['users', userId, ...segments].join('/')
}

function toRemoteSettingsData(settings: Settings) {
  return {
    blockRules: settings.blockRules,
    adultFilter: settings.adultFilter,
    locations: settings.locations,
    streakDisplayMode: settings.streakDisplayMode,
    uiMode: settings.uiMode,
    customQuotes: settings.customQuotes,
    lockMode: sanitizeLockModeForCloud(settings.lockMode),
    updatedAt: settings.updatedAt,
  }
}

function latestCooldownTimestamp(cooldownState: CooldownState): number {
  return Math.max(0, ...Object.values(cooldownState.lastAccess))
}

function fromCloudDailyStatsDocuments(
  docs: CloudDailyStatsDocument[],
): Record<string, DailyStats> {
  return Object.fromEntries(
    docs.map((entry) => [entry.data.date, entry.data]),
  )
}

export function createFirestoreSyncRemoteAdapter(
  firestore: Firestore | null = getFirebaseFirestore(),
): SyncRemoteAdapter | null {
  if (!firestore) {
    return null
  }

  return {
    async pull(userId: string): Promise<LocalSyncSnapshot | null> {
      const [
        settingsSnap,
        streakSnap,
        runtimeSnap,
        dailyStatsSnap,
        tombstonesSnap,
      ] = await Promise.all([
        getDoc(doc(firestore, getUserDocPath(userId, 'settings', 'current'))),
        getDoc(doc(firestore, getUserDocPath(userId, 'streak', 'data'))),
        getDoc(doc(firestore, getUserDocPath(userId, 'meta', 'runtime'))),
        getDocs(collection(firestore, getUserDocPath(userId, 'dailyStats'))),
        getDoc(doc(firestore, getUserDocPath(userId, 'tombstones', 'current'))),
      ])

      if (
        !settingsSnap.exists() &&
        !streakSnap.exists() &&
        dailyStatsSnap.empty &&
        !runtimeSnap.exists() &&
        !tombstonesSnap.exists()
      ) {
        return null
      }

      const dailyStatsDocs = dailyStatsSnap.docs
        .map((entry) => entry.data() as CloudDailyStatsDocument)

      return {
        settings: settingsSnap.exists()
          ? {
              ...settingsSnap.data().data,
            }
          : {
              blockRules: [],
              adultFilter: false,
              locations: [],
              streakDisplayMode: 'number',
              uiMode: 'mascot',
              customQuotes: [],
              lockMode: {
                enabled: false,
                level: 'off',
                passwordHash: null,
                passwordSalt: null,
                challengeText: null,
                nuclearUntil: null,
                delayUnlockUntil: null,
                updatedAt: 0,
              },
              updatedAt: 0,
            },
        streakData: streakSnap.exists()
          ? migrateStreakData(streakSnap.data().data)
          : {
              perRule: {},
              global: [],
              updatedAt: 0,
            },
        dailyStatsHistory: fromCloudDailyStatsDocuments(dailyStatsDocs),
        cooldownState: runtimeSnap.exists()
          ? (runtimeSnap.data().data as CooldownState)
          : { lastAccess: {} },
        deletedMap: tombstonesSnap.exists()
          ? ((tombstonesSnap.data() as CloudTombstonesDocument).deleted ?? createEmptyDeletedMap())
          : createEmptyDeletedMap(),
      }
    },

    async push(userId: string, snapshot: LocalSyncSnapshot): Promise<void> {
      const now = Date.now()
      const settingsRef = doc(firestore, getUserDocPath(userId, 'settings', 'current'))
      const streakRef = doc(firestore, getUserDocPath(userId, 'streak', 'data'))
      const runtimeRef = doc(firestore, getUserDocPath(userId, 'meta', 'runtime'))
      const syncMetaRef = doc(firestore, getUserDocPath(userId, 'meta', 'sync'))
      const tombstonesRef = doc(firestore, getUserDocPath(userId, 'tombstones', 'current'))

      await Promise.all([
        setDoc(settingsRef, createCloudDocument(
          toRemoteSettingsData(snapshot.settings),
          snapshot.settings.updatedAt,
          userId,
        )),
        setDoc(streakRef, createCloudDocument(
          snapshot.streakData,
          snapshot.streakData.updatedAt,
          userId,
        )),
        setDoc(runtimeRef, createCloudDocument(
          snapshot.cooldownState,
          latestCooldownTimestamp(snapshot.cooldownState),
          userId,
        )),
        setDoc(tombstonesRef, {
          deleted: snapshot.deletedMap,
          updatedAt: now,
        }),
        setDoc(syncMetaRef, {
          lastPulledAt: null,
          lastPushedAt: now,
          lastError: null,
        }),
        ...Object.values(snapshot.dailyStatsHistory).map((dailyStats) => {
          const dailyStatsRef = doc(
            firestore,
            getUserDocPath(userId, 'dailyStats', dailyStats.date),
          )

          return setDoc(
            dailyStatsRef,
            createCloudDocument(dailyStats, now, userId),
          )
        }),
      ])
    },

    subscribe(userId, listener, onError) {
      const handleSubscriptionError = async (error: unknown): Promise<void> => {
        console.error('LockInTime: firestore sync listener failed', error)
        await onError?.(error)
      }

      const handleRemoteUpdate = async (): Promise<void> => {
        try {
          const snapshot = await this.pull(userId)
          if (snapshot) {
            await listener(snapshot)
          }
        } catch (error) {
          await handleSubscriptionError(error)
        }
      }

      const unsubscribers = [
        onSnapshot(
          doc(firestore, getUserDocPath(userId, 'settings', 'current')),
          () => {
            void handleRemoteUpdate()
          },
          (error) => {
            void handleSubscriptionError(error)
          },
        ),
        onSnapshot(
          doc(firestore, getUserDocPath(userId, 'streak', 'data')),
          () => {
            void handleRemoteUpdate()
          },
          (error) => {
            void handleSubscriptionError(error)
          },
        ),
        onSnapshot(
          doc(firestore, getUserDocPath(userId, 'meta', 'runtime')),
          () => {
            void handleRemoteUpdate()
          },
          (error) => {
            void handleSubscriptionError(error)
          },
        ),
        onSnapshot(
          collection(firestore, getUserDocPath(userId, 'dailyStats')),
          () => {
            void handleRemoteUpdate()
          },
          (error) => {
            void handleSubscriptionError(error)
          },
        ),
        onSnapshot(
          doc(firestore, getUserDocPath(userId, 'tombstones', 'current')),
          () => {
            void handleRemoteUpdate()
          },
          (error) => {
            void handleSubscriptionError(error)
          },
        ),
      ]

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe()
        }
      }
    },
  }
}
