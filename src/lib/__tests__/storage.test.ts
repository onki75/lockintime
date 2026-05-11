import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GroupRule, SiteRule } from '../types'
import {
  DEFAULT_BACKGROUND_STATE,
  DEFAULT_LICENSE_CACHE,
  DEFAULT_SETTINGS,
} from '../defaults'

type StorageShape = {
  settings?: unknown
  deletedMap?: unknown
  streakData?: unknown
  trialStartDate?: unknown
  dailyStats?: unknown
  dailyStatsHistory?: unknown
  cooldownState?: unknown
  bypassState?: unknown
  locationState?: unknown
  licenseCache?: unknown
}

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function createChromeStorageMock(initialState: StorageShape = {}) {
  let state = deepClone(initialState)

  return {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[]) => {
          const keys = Array.isArray(key) ? key : [key]
          return Object.fromEntries(
            keys.map((entry) => [
              entry,
              entry in state
                ? deepClone(state[entry as keyof StorageShape])
                : undefined,
            ]),
          )
        }),
        set: vi.fn(async (data: Record<string, unknown>) => {
          state = {
            ...state,
            ...deepClone(data),
          }
        }),
      },
    },
  }
}

async function loadStorageModule(initialState: StorageShape = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()

  vi.stubGlobal('chrome', createChromeStorageMock(initialState))
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'test-rule-id'),
  })

  return import('../storage')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getSettings', () => {
  it('returns default settings when none saved', async () => {
    const { getSettings } = await loadStorageModule()

    const settings = await getSettings()

    expect(settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('background state storage', () => {
  it('defaults malformed persisted runtime state', async () => {
    const { getBackgroundState } = await loadStorageModule({
      dailyStats: {
        date: '2026-03-16',
        counts: { 'youtube.com': Number.NaN },
        durations: {},
      },
      cooldownState: {
        lastAccess: { 'rule-1': Number.POSITIVE_INFINITY },
      },
      licenseCache: {
        plan: 'pro',
        lastVerified: Number.NaN,
        source: 'cloud',
        expiresAt: null,
      },
    })

    await expect(getBackgroundState()).resolves.toMatchObject({
      dailyStats: null,
      cooldownState: DEFAULT_BACKGROUND_STATE.cooldownState,
      licenseCache: DEFAULT_LICENSE_CACHE,
    })
  })

  it('serializes daily stats updates so concurrent writes do not drop domains', async () => {
    const { updateDailyStats, getBackgroundState } = await loadStorageModule({
      dailyStats: {
        date: '2026-03-16',
        counts: {},
        durations: {},
      },
      dailyStatsHistory: {},
    })

    await Promise.all([
      updateDailyStats((current) => ({
        date: current?.date ?? '2026-03-16',
        counts: {
          ...(current?.counts ?? {}),
          'youtube.com': ((current?.counts ?? {})['youtube.com'] ?? 0) + 1,
        },
        durations: current?.durations ?? {},
      })),
      updateDailyStats((current) => ({
        date: current?.date ?? '2026-03-16',
        counts: {
          ...(current?.counts ?? {}),
          'x.com': ((current?.counts ?? {})['x.com'] ?? 0) + 1,
        },
        durations: current?.durations ?? {},
      })),
    ])

    await expect(getBackgroundState()).resolves.toMatchObject({
      dailyStats: {
        date: '2026-03-16',
        counts: {
          'youtube.com': 1,
          'x.com': 1,
        },
        durations: {},
      },
    })
  })
})

describe('streak storage', () => {
  it('returns default streak data when none is saved', async () => {
    const { getStreakData } = await loadStorageModule()

    await expect(getStreakData()).resolves.toEqual({
      perRule: {},
      global: [],
      updatedAt: 0,
    })
  })

  it('migrates legacy streak records when loading from storage', async () => {
    const { getStreakData } = await loadStorageModule({
      streakData: {
        perRule: {},
        global: [
          { date: '2026-03-15', success: true },
          { date: '2026-03-16', success: false },
        ],
        updatedAt: 5,
      },
    })

    await expect(getStreakData()).resolves.toEqual({
      perRule: {},
      global: [
        { date: '2026-03-15', success: true, status: 'success' },
        { date: '2026-03-16', success: false, status: 'failure' },
      ],
      updatedAt: 5,
    })
  })
})

describe('addSiteRule', () => {
  it('adds a rule', async () => {
    const { addSiteRule, getSettings } = await loadStorageModule()

    const rule = await addSiteRule('youtube.com', [{ type: 'full_block' }])
    const settings = await getSettings()

    expect(rule).toMatchObject({
      id: 'test-rule-id',
      type: 'site',
      url: 'youtube.com',
      restrictions: [{ type: 'full_block' }],
    })
    expect(settings.blockRules).toHaveLength(1)
    expect(settings.blockRules[0]).toMatchObject({
      id: 'test-rule-id',
      type: 'site',
      url: 'youtube.com',
    })
    expect(settings.freeActiveRuleIds).toEqual(['test-rule-id'])
  })

  it('normalizes the saved domain and rejects duplicates', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-site-rule',
        type: 'site',
        url: 'youtube.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    const { addSiteRule } = await loadStorageModule({ settings: existingSettings })

    await expect(addSiteRule('WWW.YouTube.com', [{ type: 'full_block' }])).rejects.toThrow(
      'このサイトは既に追加されています',
    )
  })

  it('allows adding an individual rule even when the domain exists in a group', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-group-rule',
        type: 'group',
        name: '動画サイト',
        urls: ['youtube.com', 'netflix.com'],
        restrictions: [{ type: 'full_block' }],
        preset: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    const { addSiteRule, getSettings } = await loadStorageModule({ settings: existingSettings })

    const rule = await addSiteRule('WWW.YouTube.com', [{ type: 'full_block' }])
    const settings = await getSettings()

    expect(rule.url).toBe('youtube.com')
    expect(settings.blockRules).toHaveLength(2)
    expect(settings.blockRules[1]).toMatchObject({
      id: 'test-rule-id',
      type: 'site',
      url: 'youtube.com',
    })
  })

  it('rejects invalid URLs before duplicate checks', async () => {
    const { addSiteRule } = await loadStorageModule()

    await expect(addSiteRule('example', [{ type: 'full_block' }])).rejects.toThrow(
      '無効なURLです',
    )
  })
})

describe('addGroupRule', () => {
  it('adds a preset-backed group rule and makes it active', async () => {
    const { addGroupRule, getSettings } = await loadStorageModule()

    const rule = await addGroupRule(
      'SNS',
      ['WWW.Twitter.com', 'https://x.com/home'],
      [{ type: 'full_block' }],
      true,
    )
    const settings = await getSettings()

    expect(rule).toMatchObject({
      id: 'test-rule-id',
      type: 'group',
      name: 'SNS',
      urls: ['twitter.com', 'x.com'],
      restrictions: [{ type: 'full_block' }],
      preset: true,
    })
    expect(settings.blockRules).toHaveLength(1)
    expect(settings.blockRules[0]).toMatchObject({
      id: 'test-rule-id',
      type: 'group',
      name: 'SNS',
      urls: ['twitter.com', 'x.com'],
    })
    expect(settings.freeActiveRuleIds).toEqual(['test-rule-id'])
  })

  it('adds an empty custom group for later editing', async () => {
    const { addGroupRule } = await loadStorageModule()

    await expect(addGroupRule('カスタムグループ')).resolves.toMatchObject({
      type: 'group',
      name: 'カスタムグループ',
      urls: [],
      restrictions: [{ type: 'full_block' }],
      preset: false,
    })
  })
})

describe('addLocation', () => {
  it('rejects invalid location data', async () => {
    const { addLocation } = await loadStorageModule()

    await expect(addLocation('   ', 35.0, 139.0, 120)).rejects.toThrow('無効な場所データです')
    await expect(addLocation('Home', 91, 139.0, 120)).rejects.toThrow('無効な場所データです')
    await expect(addLocation('Home', 35.0, 181, 120)).rejects.toThrow('無効な場所データです')
    await expect(addLocation('Home', 35.0, 139.0, 0)).rejects.toThrow('無効な場所データです')
  })
})

describe('checkDuplicate', () => {
  it('returns duplicate_site for an existing site rule', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-site-rule',
        type: 'site',
        url: 'youtube.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    const { checkDuplicate } = await loadStorageModule({ settings: existingSettings })

    await expect(checkDuplicate('WWW.YouTube.com')).resolves.toMatchObject({
      status: 'duplicate_site',
      existingRule: {
        id: 'existing-site-rule',
        url: 'youtube.com',
      },
    })
  })

  it('returns exists_in_group when the domain is already in a group rule', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-group-rule',
        type: 'group',
        name: 'SNS',
        urls: ['twitter.com', 'x.com'],
        restrictions: [{ type: 'full_block' }],
        preset: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    const { checkDuplicate } = await loadStorageModule({ settings: existingSettings })

    await expect(checkDuplicate('WWW.Twitter.com')).resolves.toEqual({
      status: 'exists_in_group',
      groupName: 'SNS',
    })
  })

  it('returns ok when the domain does not exist', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-group-rule',
        type: 'group',
        name: 'SNS',
        urls: ['twitter.com', 'x.com'],
        restrictions: [{ type: 'full_block' }],
        preset: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    const { checkDuplicate } = await loadStorageModule({ settings: existingSettings })

    await expect(checkDuplicate('youtube.com')).resolves.toEqual({ status: 'ok' })
  })
})

describe('removeRule', () => {
  it('removes a rule', async () => {
    const { addSiteRule, removeRule, getSettings } = await loadStorageModule()

    const rule = await addSiteRule('youtube.com', [{ type: 'full_block' }])
    await removeRule(rule.id)

    const settings = await getSettings()

    expect(settings.blockRules).toEqual([])
  })
})

describe('removeLocation', () => {
  it('removes a location', async () => {
    const { addLocation, removeLocation, getSettings } = await loadStorageModule()

    const location = await addLocation('Home', 35.0, 139.0, 120)
    await removeLocation(location.id)

    const settings = await getSettings()

    expect(settings.locations).toEqual([])
  })
})

describe('getBlockedDomains', () => {
  it('gets the domain from a site rule', async () => {
    const { getBlockedDomains } = await loadStorageModule()

    const rule: SiteRule = {
      id: '1',
      type: 'site',
      url: 'youtube.com',
      restrictions: [{ type: 'full_block' }],
      createdAt: 0,
      updatedAt: 0,
    }

    expect(getBlockedDomains(rule)).toEqual(['youtube.com'])
  })

  it('gets all domains from a group rule', async () => {
    const { getBlockedDomains } = await loadStorageModule()

    const rule: GroupRule = {
      id: 'g1',
      type: 'group',
      name: 'SNS',
      urls: ['twitter.com', 'x.com'],
      restrictions: [{ type: 'full_block' }],
      preset: true,
      createdAt: 0,
      updatedAt: 0,
    }

    expect(getBlockedDomains(rule)).toEqual(['twitter.com', 'x.com'])
  })
})

describe('getFullBlockDomains', () => {
  it('returns only domains from full_block rules', async () => {
    const { getFullBlockDomains } = await loadStorageModule()

    const domains = getFullBlockDomains([
      {
        id: '1',
        type: 'site',
        url: 'youtube.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '2',
        type: 'site',
        url: 'twitter.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '3',
        type: 'site',
        url: 'instagram.com',
        restrictions: [{ type: 'daily_count', maxCount: 3 }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '4',
        type: 'group',
        name: 'Video',
        urls: ['netflix.com', 'youtube.com'],
        restrictions: [{ type: 'full_block' }],
        preset: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ])

    expect(domains).toEqual(['youtube.com', 'twitter.com', 'netflix.com', 'youtube.com'])
  })
})
