import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BlockRule,
  CooldownState,
  DailyStats,
  Settings,
} from '../../lib/types'

type Listener<T extends (...args: any[]) => unknown> = T | undefined

type InstalledListener = (
  details: chrome.runtime.InstalledDetails,
) => void | Promise<void>
type StorageChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void | Promise<void>
type AlarmListener = (alarm: chrome.alarms.Alarm) => void | Promise<void>

function createEvent<T extends (...args: any[]) => unknown>() {
  let listener: Listener<T>

  return {
    addListener: vi.fn((value: T) => {
      listener = value
    }),
    getListener: () => listener,
  }
}

const syncRulesMock = vi.fn(async () => undefined)
const getSettingsMock = vi.fn<() => Promise<Settings>>()
const getBackgroundStateMock = vi.fn<
  () => Promise<{ cooldownState: CooldownState; dailyStats: DailyStats | null }>
>()
const setTrialStartDateMock = vi.fn<(value: number) => Promise<void>>()
const resetDailyStatsMock = vi.fn<(stats: DailyStats) => Promise<void>>()

const onInstalled = createEvent<InstalledListener>()
const onChanged = createEvent<StorageChangedListener>()
const onAlarm = createEvent<AlarmListener>()

const createAlarmMock = vi.fn()

const baseSettings: Settings = {
  blockRules: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
}

function makeRule(overrides: Partial<BlockRule> = {}): BlockRule {
  return {
    id: 'rule-1',
    type: 'site',
    url: 'youtube.com',
    enabled: true,
    restrictions: [{ type: 'full_block' }],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as BlockRule
}

async function loadBackgroundModule() {
  vi.resetModules()

  vi.doMock('../../lib/storage', () => ({
    getSettings: getSettingsMock,
    getBackgroundState: getBackgroundStateMock,
    setTrialStartDate: setTrialStartDateMock,
    resetDailyStats: resetDailyStatsMock,
  }))

  vi.doMock('../../lib/rules', () => ({
    syncRules: syncRulesMock,
  }))

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled,
    },
    storage: {
      onChanged,
    },
    alarms: {
      onAlarm,
      create: createAlarmMock,
    },
  })

  const module = await import('../index')
  await module.backgroundReady
  return module
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useFakeTimers()

  vi.setSystemTime(new Date('2026-03-16T10:30:00'))

  getSettingsMock.mockResolvedValue(baseSettings)
  getBackgroundStateMock.mockResolvedValue({
    cooldownState: { lastAccess: {} },
    dailyStats: null,
  })
  setTrialStartDateMock.mockResolvedValue(undefined)
  resetDailyStatsMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('background service worker', () => {
  it('registers listeners and restores alarms on startup', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [
        makeRule({
          id: 'cooldown-rule',
          restrictions: [{ type: 'cooldown', cooldownMinutes: 30 }],
        }),
      ],
    })
    getBackgroundStateMock.mockResolvedValue({
      cooldownState: {
        lastAccess: {
          'cooldown-rule': new Date('2026-03-16T10:20:00').getTime(),
        },
      },
      dailyStats: null,
    })

    await loadBackgroundModule()

    expect(onInstalled.addListener).toHaveBeenCalledTimes(1)
    expect(onChanged.addListener).toHaveBeenCalledTimes(1)
    expect(onAlarm.addListener).toHaveBeenCalledTimes(1)
    expect(createAlarmMock).toHaveBeenCalledWith('daily-reset', {
      when: new Date('2026-03-17T00:00:00').getTime(),
      periodInMinutes: 24 * 60,
    })
    expect(createAlarmMock).toHaveBeenCalledWith('cooldown:cooldown-rule', {
      when: new Date('2026-03-16T10:50:00').getTime(),
    })
  })

  it('stores trial start date and syncs rules on install', async () => {
    const installTime = new Date('2026-03-16T11:45:00').getTime()
    vi.setSystemTime(installTime)
    const settings = {
      ...baseSettings,
      blockRules: [makeRule()],
    }
    getSettingsMock.mockResolvedValue(settings)

    await loadBackgroundModule()
    const listener = onInstalled.getListener()

    expect(listener).toBeTypeOf('function')

    await listener?.({ reason: 'install' } as chrome.runtime.InstalledDetails)

    expect(setTrialStartDateMock).toHaveBeenCalledWith(installTime)
    expect(syncRulesMock).toHaveBeenCalledWith(settings.blockRules)
  })

  it('syncs rules without resetting trial start date on update', async () => {
    const settings = {
      ...baseSettings,
      blockRules: [makeRule()],
    }
    getSettingsMock.mockResolvedValue(settings)

    await loadBackgroundModule()
    const listener = onInstalled.getListener()

    await listener?.({ reason: 'update' } as chrome.runtime.InstalledDetails)

    expect(setTrialStartDateMock).not.toHaveBeenCalled()
    expect(syncRulesMock).toHaveBeenCalledWith(settings.blockRules)
  })

  it('syncs rules when local settings change', async () => {
    await loadBackgroundModule()
    const listener = onChanged.getListener()
    const settings = {
      ...baseSettings,
      blockRules: [makeRule({ id: 'rule-2', url: 'x.com' })],
    }

    await listener?.(
      {
        settings: {
          oldValue: baseSettings,
          newValue: settings,
        },
      },
      'local',
    )

    expect(syncRulesMock).toHaveBeenCalledWith(settings.blockRules)
  })

  it('ignores storage changes outside local settings', async () => {
    await loadBackgroundModule()
    const listener = onChanged.getListener()

    await listener?.(
      {
        dailyStats: {
          oldValue: null,
          newValue: null,
        },
      },
      'local',
    )
    await listener?.(
      {
        settings: {
          oldValue: baseSettings,
          newValue: baseSettings,
        },
      },
      'sync',
    )

    expect(syncRulesMock).not.toHaveBeenCalled()
  })

  it('resets daily stats at local midnight when the daily alarm fires', async () => {
    await loadBackgroundModule()
    const listener = onAlarm.getListener()

    await listener?.({ name: 'daily-reset' } as chrome.alarms.Alarm)

    expect(resetDailyStatsMock).toHaveBeenCalledWith({
      date: '2026-03-16',
      counts: {},
      durations: {},
    })
  })
})
