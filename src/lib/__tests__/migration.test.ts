import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings, StreakData } from '../types'
import {
  DEFAULT_LOCK_MODE,
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
          restrictions: [{ type: 'full_block' }],
          createdAt: fixedNow,
          updatedAt: fixedNow,
        },
        {
          id: 'rule-2',
          type: 'site',
          url: 'x.com',
          restrictions: [{ type: 'full_block' }],
          createdAt: fixedNow,
          updatedAt: fixedNow,
        },
      ],
      freeActiveRuleIds: ['rule-1'],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      customQuotes: [],
      screenTimeGoal: DEFAULT_SCREEN_TIME_GOAL,
      lockMode: {
        ...DEFAULT_LOCK_MODE,
        updatedAt: fixedNow,
      },
      updatedAt: fixedNow,
    })
  })

  it('normalizes and filters unsafe legacy v0 rule urls', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        { id: 'rule-1', url: 'https://www.youtube.com/watch?v=abc', enabled: true },
        { id: 'rule-2', url: 'youtube.com|http://evil.com', enabled: true },
        { id: 'rule-3', url: '*.example.com', enabled: false },
      ],
      focusMode: true,
      focusDuration: 25,
    })

    expect(migrated.blockRules).toEqual([
      {
        id: 'rule-1',
        type: 'site',
        url: 'youtube.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: fixedNow,
        updatedAt: fixedNow,
      },
      {
        id: 'rule-3',
        type: 'site',
        url: 'example.com',
        restrictions: [{ type: 'full_block' }],
        createdAt: fixedNow,
        updatedAt: fixedNow,
      },
    ])
    expect(migrated.freeActiveRuleIds).toEqual(['rule-1'])
  })

  it('returns v1 settings unchanged', async () => {
    const { migrateSettings } = await loadMigrationModule()
    const settings = makeSettings({
      blockRules: [
        {
          id: 'rule-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      freeActiveRuleIds: ['rule-1'],
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

  it('salvages valid current settings fields when individual entries are malformed', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        {
          id: 'site-1',
          type: 'site',
          url: 'https://www.youtube.com/watch?v=abc',
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
        { id: 'broken-rule' },
        {
          id: 'group-1',
          type: 'group',
          name: 'Social',
          urls: ['x.com', 'https://www.instagram.com/p/test', 'x.com'],
          restrictions: [{ type: 'full_block' }],
          preset: false,
          createdAt: 300,
          updatedAt: 400,
        },
      ],
      freeActiveRuleIds: ['site-1', 'missing-rule', 'group-1'],
      adultFilter: true,
      locations: [
        {
          id: 'loc-1',
          name: 'Office',
          latitude: 35.0,
          longitude: 139.0,
          radiusMeters: 100,
        },
        { id: 'broken-location' },
      ],
      streakDisplayMode: 'heatmap',
      customQuotes: [
        {
          id: 'quote-1',
          content: 'Stay focused.',
          createdAt: 500,
          updatedAt: 600,
        },
        { id: 'broken-quote' },
      ],
      screenTimeGoal: {
        enabled: true,
        dailyLimitMinutes: 45,
      },
      lockMode: {
        enabled: true,
        level: 'hard',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        challengeText: null,
        nuclearUntil: null,
        delayUnlockUntil: null,
        updatedAt: 700,
      },
      updatedAt: 800,
    })

    expect(migrated).toEqual({
      blockRules: [
        {
          id: 'site-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
        {
          id: 'group-1',
          type: 'group',
          name: 'Social',
          urls: ['x.com', 'instagram.com'],
          restrictions: [{ type: 'full_block' }],
          preset: false,
          createdAt: 300,
          updatedAt: 400,
        },
      ],
      freeActiveRuleIds: ['site-1', 'group-1'],
      adultFilter: true,
      locations: [
        {
          id: 'loc-1',
          name: 'Office',
          latitude: 35.0,
          longitude: 139.0,
          radiusMeters: 100,
          updatedAt: 0,
        },
      ],
      streakDisplayMode: 'heatmap',
      customQuotes: [
        {
          id: 'quote-1',
          content: 'Stay focused.',
          createdAt: 500,
          updatedAt: 600,
        },
      ],
      screenTimeGoal: {
        enabled: true,
        dailyLimitMinutes: 45,
      },
      lockMode: {
        enabled: true,
        level: 'hard',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        challengeText: null,
        nuclearUntil: null,
        delayUnlockUntil: null,
        updatedAt: 700,
      },
      updatedAt: 800,
    })
  })

  it('defaults malformed current settings fields without dropping valid rules', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        {
          id: 'rule-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      adultFilter: 'yes',
      locations: 'invalid',
      streakDisplayMode: 'calendar',
      customQuotes: 'invalid',
      screenTimeGoal: {
        enabled: true,
        dailyLimitMinutes: -1,
      },
      lockMode: {
        enabled: true,
        level: 'invalid',
        passwordHash: 'hash',
        updatedAt: 300,
      },
      updatedAt: 'invalid',
    })

    expect(migrated).toEqual({
      ...makeSettings(),
      blockRules: [
        {
          id: 'rule-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      freeActiveRuleIds: ['rule-1'],
    })
  })

  it('derives freeActiveRuleIds from legacy enabled flags in current settings', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
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
        {
          id: 'rule-2',
          type: 'site',
          url: 'x.com',
          enabled: false,
          restrictions: [{ type: 'full_block' }],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      customQuotes: [],
      screenTimeGoal: DEFAULT_SCREEN_TIME_GOAL,
      lockMode: DEFAULT_LOCK_MODE,
      updatedAt: 400,
    })

    expect(migrated.freeActiveRuleIds).toEqual(['rule-1'])
  })
})

describe('migrateSettings daily_count defaults', () => {
  it('defaults perSessionMinutes to 10 on daily_count rules that lack the property', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        {
          id: 'site-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'daily_count', maxCount: 3 }],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    expect(migrated.blockRules[0].restrictions[0]).toEqual({
      type: 'daily_count',
      maxCount: 3,
      perSessionMinutes: 10,
    })
  })

  it('coerces null perSessionMinutes back to the 10-minute default', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        {
          id: 'site-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: null }],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    expect(migrated.blockRules[0].restrictions[0]).toEqual({
      type: 'daily_count',
      maxCount: 3,
      perSessionMinutes: 10,
    })
  })

  it('preserves an existing positive perSessionMinutes', async () => {
    const { migrateSettings } = await loadMigrationModule()

    const migrated = migrateSettings({
      blockRules: [
        {
          id: 'site-1',
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'daily_count', maxCount: 5, perSessionMinutes: 30 }],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    expect(migrated.blockRules[0].restrictions[0]).toEqual({
      type: 'daily_count',
      maxCount: 5,
      perSessionMinutes: 30,
    })
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
