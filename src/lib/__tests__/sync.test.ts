import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CooldownState,
  DailyStats,
  DeletedMap,
  Settings,
  StreakData,
  SyncState,
} from '../types'
import { DEFAULT_LOCK_MODE } from '../defaults'
import type { LocalSyncSnapshot } from '../sync'

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    blockRules: [],
    adultFilter: false,
    locations: [],
    streakDisplayMode: 'number',
    uiMode: 'mascot',
    customQuotes: [],
    lockMode: DEFAULT_LOCK_MODE,
    updatedAt: 0,
    ...overrides,
  }
}

function makeStreakData(overrides: Partial<StreakData> = {}): StreakData {
  return {
    perRule: {},
    global: [],
    updatedAt: 0,
    ...overrides,
  }
}

const localDaily: DailyStats = {
  date: '2026-03-16',
  counts: { youtube: 2 },
  durations: { youtube: 120 },
}

const remoteDaily: DailyStats = {
  date: '2026-03-16',
  counts: { youtube: 3, x: 1 },
  durations: { youtube: 30, x: 15 },
}

const emptyDeletedMap: DeletedMap = {
  blockRules: {},
  locations: {},
  customQuotes: {},
  dailyStats: {},
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mergeDailyStats', () => {
  it('adds counts and durations for the same date', async () => {
    const { mergeDailyStats } = await import('../sync')

    expect(mergeDailyStats(localDaily, remoteDaily)).toEqual({
      date: '2026-03-16',
      counts: { youtube: 5, x: 1 },
      durations: { youtube: 150, x: 15 },
    })
  })
})

describe('mergeStreakData', () => {
  it('prefers failure when the same day exists in both local and remote streaks', async () => {
    const { mergeStreakData } = await import('../sync')

    expect(
      mergeStreakData(
        makeStreakData({
          global: [{ date: '2026-03-16', success: true }],
        }),
        makeStreakData({
          global: [{ date: '2026-03-16', success: false }],
        }),
      ),
    ).toEqual({
      perRule: {},
      global: [{ date: '2026-03-16', success: false }],
      updatedAt: 0,
    })
  })
})

describe('mergeSettings', () => {
  it('applies last-write-wins fields while preserving newer local data', async () => {
    const { mergeSettings } = await import('../sync')

    const local = makeSettings({
      adultFilter: false,
      updatedAt: 200,
    })
    const remote = makeSettings({
      adultFilter: true,
      updatedAt: 100,
    })

    expect(mergeSettings(local, remote)).toEqual(local)
  })

  it('removes entities hidden behind tombstones while preserving local lock secrets', async () => {
    const { mergeSettings } = await import('../sync')

    const local = makeSettings({
      blockRules: [
        {
          id: 'deleted-rule',
          type: 'site',
          url: 'youtube.com',
          enabled: true,
          restrictions: [{ type: 'full_block' }],
          createdAt: 1,
          updatedAt: 5,
        },
      ],
      lockMode: {
        ...DEFAULT_LOCK_MODE,
        enabled: true,
        level: 'hard',
        passwordHash: 'local-secret',
        passwordSalt: 'salt',
        updatedAt: 20,
      },
      updatedAt: 20,
    })
    const remote = makeSettings({
      lockMode: {
        ...DEFAULT_LOCK_MODE,
        enabled: true,
        level: 'hard',
        passwordHash: null,
        passwordSalt: null,
        updatedAt: 21,
      },
      updatedAt: 21,
    })

    const merged = mergeSettings(local, remote, {
      ...emptyDeletedMap,
      blockRules: {
        'deleted-rule': 10,
      },
    })

    expect(merged.blockRules).toEqual([])
    expect(merged.lockMode.passwordHash).toBe('local-secret')
    expect(merged.lockMode.passwordSalt).toBe('salt')
  })
})

describe('createSyncService', () => {
  it('pulls remote data, saves the merged snapshot, and pushes on demand', async () => {
    const { createSyncService } = await import('../sync')

    const subscribeMock = vi.fn(
      (_userId: string, _listener: (snapshot: LocalSyncSnapshot) => void | Promise<void>) => vi.fn(),
    )
    const pullMock = vi.fn(async () => ({
      settings: makeSettings({ adultFilter: true, updatedAt: 10 }),
      streakData: makeStreakData({
        global: [{ date: '2026-03-15', success: true }],
      }),
      dailyStatsHistory: {
        '2026-03-16': remoteDaily,
      },
      cooldownState: { lastAccess: { youtube: 100 } } satisfies CooldownState,
      deletedMap: emptyDeletedMap,
    }))
    const pushMock = vi.fn(async () => undefined)
    const saveSnapshotMock = vi.fn(async () => undefined)
    const updateStateMock = vi.fn(async (_state: SyncState) => undefined)

    const service = createSyncService({
      userId: 'user-1',
      remote: {
        pull: pullMock,
        push: pushMock,
        subscribe: subscribeMock,
      },
      loadLocalSnapshot: async () => ({
        settings: makeSettings({ adultFilter: false, updatedAt: 20 }),
        streakData: makeStreakData(),
        dailyStatsHistory: {
          '2026-03-16': localDaily,
        },
        cooldownState: { lastAccess: {} },
        deletedMap: emptyDeletedMap,
      }),
      saveMergedSnapshot: saveSnapshotMock,
      updateSyncState: updateStateMock,
      now: () => 1234,
    })

    await service.start()
    await service.forceSync()

    expect(pullMock).toHaveBeenCalledTimes(2)
    expect(saveSnapshotMock).toHaveBeenCalledWith({
      settings: makeSettings({ adultFilter: false, updatedAt: 20 }),
      streakData: makeStreakData({
        global: [{ date: '2026-03-15', success: true }],
      }),
      dailyStatsHistory: {
        '2026-03-16': {
          date: '2026-03-16',
          counts: { youtube: 5, x: 1 },
          durations: { youtube: 150, x: 15 },
        },
      },
      cooldownState: { lastAccess: { youtube: 100 } },
      deletedMap: emptyDeletedMap,
    })
    expect(pushMock).toHaveBeenCalledWith('user-1', {
      settings: makeSettings({ adultFilter: false, updatedAt: 20 }),
      streakData: makeStreakData({
        global: [{ date: '2026-03-15', success: true }],
      }),
      dailyStatsHistory: {
        '2026-03-16': {
          date: '2026-03-16',
          counts: { youtube: 5, x: 1 },
          durations: { youtube: 150, x: 15 },
        },
      },
      cooldownState: { lastAccess: { youtube: 100 } },
      deletedMap: emptyDeletedMap,
    })
    expect(updateStateMock).toHaveBeenLastCalledWith({
      status: 'idle',
      lastSyncedAt: 1234,
      lastError: null,
      pendingPush: false,
      isApplyingRemote: false,
    })
  })

  it('drops daily stats deleted by tombstone metadata', async () => {
    const { mergeSyncSnapshots } = await import('../sync')

    expect(
      mergeSyncSnapshots(
        {
          settings: makeSettings(),
          streakData: makeStreakData(),
          dailyStatsHistory: {
            '2026-03-15': {
              date: '2026-03-15',
              counts: { youtube: 1 },
              durations: { youtube: 20 },
            },
          },
          cooldownState: { lastAccess: {} },
          deletedMap: emptyDeletedMap,
        },
        {
          settings: makeSettings(),
          streakData: makeStreakData(),
          dailyStatsHistory: {},
          cooldownState: { lastAccess: {} },
          deletedMap: {
            ...emptyDeletedMap,
            dailyStats: {
              '2026-03-15': 100,
            },
          },
        },
      ).dailyStatsHistory,
    ).toEqual({})
  })
})
