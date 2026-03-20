import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings, StreakData } from '../types'
import {
  DEFAULT_LOCK_MODE,
  DEFAULT_RESCUE_PASS,
  DEFAULT_SCREEN_TIME_GOAL,
  DEFAULT_SETTINGS,
} from '../defaults'

const fixedNow = 1_710_000_000_000

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
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
      screenTimeGoal: DEFAULT_SCREEN_TIME_GOAL,
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

  it('fills a default screenTimeGoal when current settings omit it', async () => {
    const { migrateSettings } = await loadMigrationModule()
    const settingsWithoutScreenTimeGoal = {
      ...makeSettings({
        streakDisplayMode: 'heatmap',
        updatedAt: 400,
      }),
      screenTimeGoal: undefined,
    }

    const migrated = migrateSettings(settingsWithoutScreenTimeGoal)

    expect(migrated).toEqual(
      makeSettings({
        streakDisplayMode: 'heatmap',
        screenTimeGoal: DEFAULT_SCREEN_TIME_GOAL,
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

describe('migrateRescuePass', () => {
  it('returns the current rescue pass format unchanged', async () => {
    const { migrateRescuePass } = await loadMigrationModule()
    const pass = {
      available: 3,
      frozenCount: 1,
      frozenMax: 4,
      totalEarned: 8,
      totalUsedBypass: 2,
      totalUsedFreeze: 1,
      totalUsedFeed: 3,
    }

    expect(migrateRescuePass(pass)).toEqual(pass)
  })

  it('migrates the legacy rescue pass format', async () => {
    const { migrateRescuePass } = await loadMigrationModule()

    expect(
      migrateRescuePass({
        available: 5,
        totalEarned: 11,
        totalUsed: 4,
        totalFed: 3,
      }),
    ).toEqual({
      available: 5,
      frozenCount: 0,
      frozenMax: 2,
      totalEarned: 11,
      totalUsedBypass: 4,
      totalUsedFreeze: 0,
      totalUsedFeed: 3,
    })
  })

  it('returns defaults for invalid rescue pass data', async () => {
    const { migrateRescuePass } = await loadMigrationModule()

    expect(migrateRescuePass(null)).toEqual(DEFAULT_RESCUE_PASS)
    expect(migrateRescuePass({ available: 1 })).toEqual(DEFAULT_RESCUE_PASS)
  })
})

describe('migrateStreakData', () => {
  it('adds inferred statuses to legacy streak records', async () => {
    const { migrateStreakData } = await loadMigrationModule()

    expect(
      migrateStreakData({
        perRule: {
          'rule-1': [
            { date: '2026-03-15', success: true },
            { date: '2026-03-16', success: false },
          ],
        },
        global: [
          { date: '2026-03-15', success: true },
          { date: '2026-03-16', success: false },
        ],
        updatedAt: 123,
      }),
    ).toEqual({
      perRule: {
        'rule-1': [
          { date: '2026-03-15', success: true, status: 'success' },
          { date: '2026-03-16', success: false, status: 'failure' },
        ],
      },
      global: [
        { date: '2026-03-15', success: true, status: 'success' },
        { date: '2026-03-16', success: false, status: 'failure' },
      ],
      updatedAt: 123,
    })
  })

  it('preserves valid detailed streak statuses', async () => {
    const { migrateStreakData } = await loadMigrationModule()
    const streakData = makeStreakData({
      global: [
        { date: '2026-03-15', success: true, status: 'bypass' },
        { date: '2026-03-16', success: true, status: 'repaired' },
      ],
    })

    expect(migrateStreakData(streakData)).toEqual(streakData)
  })

  it('returns defaults for invalid streak data', async () => {
    const { migrateStreakData } = await loadMigrationModule()

    expect(migrateStreakData(null)).toEqual(makeStreakData())
    expect(migrateStreakData({ global: 'invalid' })).toEqual(makeStreakData())
  })
})
