import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GroupRule, SiteRule } from '../types'
import { DEFAULT_SETTINGS } from '../defaults'

type StorageShape = {
  settings?: unknown
  rescuePass?: unknown
  mascotState?: unknown
  deletedMap?: unknown
  streakData?: unknown
}

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function createChromeStorageMock(initialState: StorageShape = {}) {
  let state = deepClone(initialState)

  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]:
            key in state
              ? deepClone(state[key as keyof StorageShape])
              : undefined,
        })),
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

describe('rescue pass storage', () => {
  it('returns the default rescue pass when none is saved', async () => {
    const { getRescuePass } = await loadStorageModule()

    await expect(getRescuePass()).resolves.toEqual({
      available: 0,
      frozenCount: 0,
      frozenMax: 2,
      totalEarned: 0,
      totalUsedBypass: 0,
      totalUsedFreeze: 0,
      totalUsedFeed: 0,
    })
  })

  it('saves and loads rescue pass data', async () => {
    const { getRescuePass, saveRescuePass } = await loadStorageModule()
    const pass = {
      available: 2,
      frozenCount: 1,
      frozenMax: 3,
      totalEarned: 5,
      totalUsedBypass: 2,
      totalUsedFreeze: 1,
      totalUsedFeed: 1,
    }

    await saveRescuePass(pass)

    await expect(getRescuePass()).resolves.toEqual(pass)
  })

  it('migrates legacy rescue pass data when loading from storage', async () => {
    const { getRescuePass } = await loadStorageModule({
      rescuePass: {
        available: 4,
        totalEarned: 9,
        totalUsed: 3,
        totalFed: 2,
      },
    })

    await expect(getRescuePass()).resolves.toEqual({
      available: 4,
      frozenCount: 0,
      frozenMax: 2,
      totalEarned: 9,
      totalUsedBypass: 3,
      totalUsedFreeze: 0,
      totalUsedFeed: 2,
    })
  })
})

describe('mascot state storage', () => {
  it('returns the default mascot state when none is saved', async () => {
    const { getMascotState } = await loadStorageModule()

    await expect(getMascotState()).resolves.toEqual({
      level: 0,
      feedCount: 0,
      lastFedAt: null,
    })
  })

  it('saves and loads mascot state', async () => {
    const { getMascotState, saveMascotState } = await loadStorageModule()
    const mascotState = {
      level: 2,
      feedCount: 7,
      lastFedAt: 1_700_000_000_000,
    }

    await saveMascotState(mascotState)

    await expect(getMascotState()).resolves.toEqual(mascotState)
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
      enabled: true,
      restrictions: [{ type: 'full_block' }],
    })
    expect(settings.blockRules).toHaveLength(1)
    expect(settings.blockRules[0]).toMatchObject({
      id: 'test-rule-id',
      type: 'site',
      url: 'youtube.com',
      enabled: true,
    })
  })

  it('normalizes the saved domain and rejects duplicates', async () => {
    const existingSettings = structuredClone(DEFAULT_SETTINGS)
    existingSettings.blockRules = [
      {
        id: 'existing-site-rule',
        type: 'site',
        url: 'youtube.com',
        enabled: true,
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
        enabled: true,
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
        enabled: true,
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
        enabled: true,
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
        enabled: true,
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
  it('removes a rule and records a tombstone', async () => {
    const { addSiteRule, removeRule, getDeletedMap, getSettings } = await loadStorageModule()

    const rule = await addSiteRule('youtube.com', [{ type: 'full_block' }])
    await removeRule(rule.id)

    const settings = await getSettings()
    const deletedMap = await getDeletedMap()

    expect(settings.blockRules).toEqual([])
    expect(deletedMap.blockRules[rule.id]).toBeTypeOf('number')
  })
})

describe('removeLocation', () => {
  it('removes a location and records a tombstone', async () => {
    const { addLocation, removeLocation, getDeletedMap, getSettings } = await loadStorageModule()

    const location = await addLocation('Home', 35.0, 139.0, 120)
    await removeLocation(location.id)

    const settings = await getSettings()
    const deletedMap = await getDeletedMap()

    expect(settings.locations).toEqual([])
    expect(deletedMap.locations[location.id]).toBeTypeOf('number')
  })
})

describe('toggleRule', () => {
  it('toggles enabled', async () => {
    const { addSiteRule, toggleRule, getSettings } = await loadStorageModule()

    const rule = await addSiteRule('youtube.com', [{ type: 'full_block' }])
    await toggleRule(rule.id)

    const settings = await getSettings()

    expect(settings.blockRules).toHaveLength(1)
    expect(settings.blockRules[0].enabled).toBe(false)
  })
})

describe('getBlockedDomains', () => {
  it('gets the domain from a site rule', async () => {
    const { getBlockedDomains } = await loadStorageModule()

    const rule: SiteRule = {
      id: '1',
      type: 'site',
      url: 'youtube.com',
      enabled: true,
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
      enabled: true,
      restrictions: [{ type: 'full_block' }],
      preset: true,
      createdAt: 0,
      updatedAt: 0,
    }

    expect(getBlockedDomains(rule)).toEqual(['twitter.com', 'x.com'])
  })
})

describe('getFullBlockDomains', () => {
  it('returns only domains from enabled full_block rules', async () => {
    const { getFullBlockDomains } = await loadStorageModule()

    const domains = getFullBlockDomains([
      {
        id: '1',
        type: 'site',
        url: 'youtube.com',
        enabled: true,
        restrictions: [{ type: 'full_block' }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '2',
        type: 'site',
        url: 'twitter.com',
        enabled: false,
        restrictions: [{ type: 'full_block' }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '3',
        type: 'site',
        url: 'instagram.com',
        enabled: true,
        restrictions: [{ type: 'daily_count', maxCount: 3 }],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '4',
        type: 'group',
        name: 'Video',
        urls: ['netflix.com', 'youtube.com'],
        enabled: true,
        restrictions: [{ type: 'full_block' }],
        preset: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ])

    expect(domains).toEqual(['youtube.com', 'netflix.com', 'youtube.com'])
  })
})
