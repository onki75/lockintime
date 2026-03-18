import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { DEFAULT_LOCK_MODE, DEFAULT_SETTINGS } from '../defaults'

const fixedNow = 1_710_000_000_000

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...overrides,
  }
}

async function loadMigrationModule() {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  })

  return import('../migration')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('migrateSettings', () => {
  it('migrates v0 settings to v1 settings', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        { id: 'rule-1', url: 'youtube.com', enabled: true },
        { id: 'rule-2', url: 'x.com', enabled: false },
      ],
      focusMode: true,
      focusDuration: 25,
    })

    expect(migrated).toEqual({
      blockRules: [
        {
          id: 'rule-1',
          type: 'site',
          url: 'youtube.com',
          enabled: true,
          restrictions: [{ type: 'full_block' }],
          createdAt: fixedNow,
          updatedAt: fixedNow,
        },
        {
          id: 'rule-2',
          type: 'site',
          url: 'x.com',
          enabled: false,
          restrictions: [{ type: 'full_block' }],
          createdAt: fixedNow,
          updatedAt: fixedNow,
        },
      ],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      uiMode: 'mascot',
      customQuotes: [],
      lockMode: {
        ...DEFAULT_LOCK_MODE,
        updatedAt: fixedNow,
      },
      updatedAt: fixedNow,
    })
  })

  it('returns v1 settings unchanged', async () => {
    const { migrateSettings } = await loadMigrationModule()
    const settings = makeSettings({
      blockRules: [
        {
          id: 'rule-1',
          type: 'site',
          url: 'youtube.com',
          enabled: true,
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      adultFilter: true,
      locations: [
        {
          id: 'loc-1',
          name: 'Office',
          latitude: 35.0,
          longitude: 139.0,
          radiusMeters: 100,
          updatedAt: 50,
        },
      ],
      streakDisplayMode: 'heatmap',
      uiMode: 'simple',
      customQuotes: [],
      lockMode: {
        enabled: true,
        level: 'soft',
        passwordHash: 'hash',
        updatedAt: 300,
      },
      updatedAt: 400,
    })

    const migrated = migrateSettings(settings)

    expect(migrated).toEqual(settings)
  })

  it('defaults uiMode to mascot when current settings omit it', async () => {
    const { migrateSettings } = await loadMigrationModule()
    const settingsWithoutUIMode = {
      ...makeSettings({
        streakDisplayMode: 'heatmap',
        updatedAt: 400,
      }),
      uiMode: undefined,
    }

    const migrated = migrateSettings(settingsWithoutUIMode)

    expect(migrated).toEqual(
      makeSettings({
        streakDisplayMode: 'heatmap',
        uiMode: 'mascot',
        updatedAt: 400,
      }),
    )
  })

  it('returns default settings for unknown data', async () => {
    const { migrateSettings } = await loadMigrationModule()

    expect(migrateSettings(null)).toEqual(makeSettings())
    expect(migrateSettings({ foo: 'bar' })).toEqual(makeSettings())
    expect(migrateSettings({ blockRules: 'invalid' })).toEqual(makeSettings())
  })
})
