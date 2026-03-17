import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GroupRule, SiteRule } from '../types'

type StorageShape = {
  settings?: unknown
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

async function loadStorageModule() {
  vi.resetModules()
  vi.unstubAllGlobals()

  vi.stubGlobal('chrome', createChromeStorageMock())
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

    expect(settings).toEqual({
      blockRules: [],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
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
