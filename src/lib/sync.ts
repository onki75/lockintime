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
  Location,
  Settings,
  StreakData,
  StreakRecord,
  SyncState,
} from './types'
import { createCloudDocument, type CloudDailyStatsDocument } from './cloud-types'
import { getFirebaseFirestore } from './firebase'

export type LocalSyncSnapshot = {
  settings: Settings
  streakData: StreakData
  dailyStatsHistory: Record<string, DailyStats>
  cooldownState: CooldownState
}

export type SyncRemoteAdapter = {
  pull: (userId: string) => Promise<LocalSyncSnapshot | null>
  push: (userId: string, snapshot: LocalSyncSnapshot) => Promise<void>
  subscribe: (
    userId: string,
    listener: (snapshot: LocalSyncSnapshot) => void | Promise<void>,
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
): Record<string, DailyStats> {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)])
  const merged: Record<string, DailyStats> = {}

  for (const date of dates) {
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

export function mergeSettings(local: Settings, remote: Settings): Settings {
  const localWins = local.updatedAt >= remote.updatedAt

  return {
    blockRules: mergeBlockRules(local.blockRules, remote.blockRules),
    adultFilter: localWins ? local.adultFilter : remote.adultFilter,
    locations: mergeLocations(local.locations, remote.locations),
    streakDisplayMode: localWins ? local.streakDisplayMode : remote.streakDisplayMode,
    uiMode: localWins ? local.uiMode : remote.uiMode,
    customQuotes: mergeCustomQuotes(local.customQuotes, remote.customQuotes),
    lockMode:
      local.lockMode.updatedAt >= remote.lockMode.updatedAt
        ? local.lockMode
        : remote.lockMode,
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
  return {
    settings: mergeSettings(local.settings, remote.settings),
    streakData: mergeStreakData(local.streakData, remote.streakData),
    dailyStatsHistory: mergeDailyStatsHistory(local.dailyStatsHistory, remote.dailyStatsHistory),
    cooldownState: mergeCooldownState(local.cooldownState, remote.cooldownState),
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

  async function setSyncState(state: SyncState): Promise<void> {
    await updateSyncState(state)
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
      await setSyncState({
        status: 'syncing',
        lastSyncedAt: null,
        lastError: null,
        pendingPush: false,
        isApplyingRemote: false,
      })

      await pullAndMerge()
      unsubscribe = remote.subscribe(userId, async (snapshot) => {
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
      })
      await setIdleState()
    },

    async forceSync(): Promise<void> {
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
      })
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
    lockMode: settings.lockMode,
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
      ] = await Promise.all([
        getDoc(doc(firestore, getUserDocPath(userId, 'settings', 'current'))),
        getDoc(doc(firestore, getUserDocPath(userId, 'streak', 'data'))),
        getDoc(doc(firestore, getUserDocPath(userId, 'meta', 'runtime'))),
        getDocs(collection(firestore, getUserDocPath(userId, 'dailyStats'))),
      ])

      if (!settingsSnap.exists() && !streakSnap.exists() && dailyStatsSnap.empty && !runtimeSnap.exists()) {
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
                updatedAt: 0,
              },
              updatedAt: 0,
            },
        streakData: streakSnap.exists()
          ? streakSnap.data().data
          : {
              perRule: {},
              global: [],
              updatedAt: 0,
            },
        dailyStatsHistory: fromCloudDailyStatsDocuments(dailyStatsDocs),
        cooldownState: runtimeSnap.exists()
          ? (runtimeSnap.data().data as CooldownState)
          : { lastAccess: {} },
      }
    },

    async push(userId: string, snapshot: LocalSyncSnapshot): Promise<void> {
      const now = Date.now()
      const settingsRef = doc(firestore, getUserDocPath(userId, 'settings', 'current'))
      const streakRef = doc(firestore, getUserDocPath(userId, 'streak', 'data'))
      const runtimeRef = doc(firestore, getUserDocPath(userId, 'meta', 'runtime'))
      const syncMetaRef = doc(firestore, getUserDocPath(userId, 'meta', 'sync'))

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

    subscribe(userId, listener) {
      const unsubscribers = [
        onSnapshot(doc(firestore, getUserDocPath(userId, 'settings', 'current')), async () => {
          const snapshot = await this.pull(userId)
          if (snapshot) {
            await listener(snapshot)
          }
        }),
        onSnapshot(doc(firestore, getUserDocPath(userId, 'streak', 'data')), async () => {
          const snapshot = await this.pull(userId)
          if (snapshot) {
            await listener(snapshot)
          }
        }),
        onSnapshot(doc(firestore, getUserDocPath(userId, 'meta', 'runtime')), async () => {
          const snapshot = await this.pull(userId)
          if (snapshot) {
            await listener(snapshot)
          }
        }),
        onSnapshot(collection(firestore, getUserDocPath(userId, 'dailyStats')), async () => {
          const snapshot = await this.pull(userId)
          if (snapshot) {
            await listener(snapshot)
          }
        }),
      ]

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe()
        }
      }
    },
  }
}
