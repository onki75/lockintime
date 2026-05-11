import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BackgroundState,
  BlockRule,
  DailyStats,
  Settings,
} from '../../lib/types'
import {
  DEFAULT_BACKGROUND_STATE,
  DEFAULT_LOCK_MODE,
  DEFAULT_SCREEN_TIME_GOAL,
} from '../../lib/defaults'

type Listener<T extends (...args: any[]) => unknown> = T | undefined

type InstalledListener = (
  details: chrome.runtime.InstalledDetails,
) => void | Promise<void>
type StorageChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void | Promise<void>
type AlarmListener = (alarm: chrome.alarms.Alarm) => void | Promise<void>
type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void

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
const updateBadgeMock = vi.fn()
const isTrialActiveMock = vi.fn(async () => false)
const startTrialMock = vi.fn(async () => undefined)
const migrateSettingsMock = vi.fn<(value: unknown) => Settings>()
const shouldShowOnboardingMock = vi.fn<() => Promise<boolean>>()
const getOnboardingUrlMock = vi.fn(() => 'chrome-extension://test/options.html?onboarding=true')
const getSettingsMock = vi.fn<() => Promise<Settings>>()
const getBackgroundStateMock = vi.fn<() => Promise<BackgroundState>>()
const saveSettingsMock = vi.fn<(settings: Settings) => Promise<void>>()
const saveDailyStatsMock = vi.fn<(stats: DailyStats) => Promise<void>>()
const saveBackgroundStateMock = vi.fn<(state: BackgroundState) => Promise<void>>()
const saveBypassStateMock = vi.fn<(state: BackgroundState['bypassState']) => Promise<void>>()
const resetDailyStatsMock = vi.fn<(stats: DailyStats) => Promise<void>>()

const onInstalled = createEvent<InstalledListener>()
const onChanged = createEvent<StorageChangedListener>()
const onAlarm = createEvent<AlarmListener>()
const onMessage = createEvent<MessageListener>()

const createAlarmMock = vi.fn()
const getAlarmMock = vi.fn()
const tabsCreateMock = vi.fn(async () => undefined)
const storageLocalGetMock = vi.fn()
const storageLocalSetMock = vi.fn(async () => undefined)
const setBadgeTextMock = vi.fn()
const setBadgeBackgroundColorMock = vi.fn()
const runtimeGetUrlMock = vi.fn((path: string) => `chrome-extension://test/${path}`)
const getDynamicRulesMock = vi.fn(async () => [])
const updateDynamicRulesMock = vi.fn(async () => undefined)

const baseSettings: Settings = {
  blockRules: [],
  freeActiveRuleIds: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
  customQuotes: [],
  screenTimeGoal: DEFAULT_SCREEN_TIME_GOAL,
  lockMode: DEFAULT_LOCK_MODE,
  updatedAt: 0,
}

function makeRule(overrides: Partial<BlockRule> = {}): BlockRule {
  return {
    id: 'rule-1',
    type: 'site',
    url: 'youtube.com',
    restrictions: [{ type: 'full_block' }],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as BlockRule
}

async function loadBackgroundModule() {
  vi.resetModules()

  vi.doMock('../../lib/storage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../lib/storage')>()

    return {
      ...actual,
      getSettings: getSettingsMock,
      getBackgroundState: getBackgroundStateMock,
      saveBackgroundState: saveBackgroundStateMock,
      saveBypassState: saveBypassStateMock,
      saveDailyStats: saveDailyStatsMock,
      saveSettings: saveSettingsMock,
      resetDailyStats: resetDailyStatsMock,
    }
  })

  vi.doMock('../../lib/rules', () => ({
    syncRules: syncRulesMock,
  }))

  vi.doMock('../../lib/badge', () => ({
    updateBadge: updateBadgeMock,
  }))

  vi.doMock('../../lib/trial', () => ({
    isTrialActive: isTrialActiveMock,
    startTrial: startTrialMock,
  }))

  vi.doMock('../../lib/migration', () => ({
    migrateSettings: migrateSettingsMock,
  }))

  vi.doMock('../../lib/onboarding', () => ({
    shouldShowOnboarding: shouldShowOnboardingMock,
    getOnboardingUrl: getOnboardingUrlMock,
  }))

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled,
      onMessage,
      getURL: runtimeGetUrlMock,
    },
    storage: {
      local: {
        get: storageLocalGetMock,
        set: storageLocalSetMock,
      },
      onChanged,
    },
    action: {
      setBadgeText: setBadgeTextMock,
      setBadgeBackgroundColor: setBadgeBackgroundColorMock,
    },
    alarms: {
      onAlarm,
      create: createAlarmMock,
      get: getAlarmMock,
    },
    tabs: {
      create: tabsCreateMock,
    },
    declarativeNetRequest: {
      getDynamicRules: getDynamicRulesMock,
      updateDynamicRules: updateDynamicRulesMock,
      RuleActionType: {
        REDIRECT: 'redirect',
      },
      ResourceType: {
        MAIN_FRAME: 'main_frame',
      },
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
  getBackgroundStateMock.mockResolvedValue(structuredClone(DEFAULT_BACKGROUND_STATE))
  migrateSettingsMock.mockImplementation((value) => value as Settings)
  shouldShowOnboardingMock.mockResolvedValue(false)
  saveSettingsMock.mockResolvedValue(undefined)
  saveDailyStatsMock.mockResolvedValue(undefined)
  saveBackgroundStateMock.mockResolvedValue(undefined)
  saveBypassStateMock.mockResolvedValue(undefined)
  resetDailyStatsMock.mockResolvedValue(undefined)
  isTrialActiveMock.mockResolvedValue(false)
  storageLocalGetMock.mockResolvedValue({ settings: baseSettings })
  getAlarmMock.mockResolvedValue(undefined)
  runtimeGetUrlMock.mockImplementation(
    (path: string) => `chrome-extension://test/${path}`,
  )
  getDynamicRulesMock.mockResolvedValue([])
  updateDynamicRulesMock.mockResolvedValue(undefined)
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
      ...structuredClone(DEFAULT_BACKGROUND_STATE),
      cooldownState: {
        lastAccess: {
          'cooldown-rule': new Date('2026-03-16T10:20:00').getTime(),
        },
      },
    })

    await loadBackgroundModule()

    expect(onInstalled.addListener).toHaveBeenCalledTimes(1)
    expect(onChanged.addListener).toHaveBeenCalledTimes(1)
    expect(onAlarm.addListener).toHaveBeenCalledTimes(1)
    expect(onMessage.addListener).toHaveBeenCalledTimes(1)
    expect(createAlarmMock).toHaveBeenCalledWith('daily-reset', {
      when: new Date('2026-03-17T00:00:00').getTime(),
      periodInMinutes: 24 * 60,
    })
    expect(createAlarmMock).toHaveBeenCalledWith('cooldown:cooldown-rule', {
      when: new Date('2026-03-16T10:50:00').getTime(),
    })
  })

  it('migrates settings, syncs rules, updates badge, and opens onboarding on install', async () => {
    const settings = {
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
    }
    getSettingsMock.mockResolvedValue(settings)
    storageLocalGetMock.mockResolvedValue({ settings: { legacy: true } })
    migrateSettingsMock.mockReturnValue(settings)
    shouldShowOnboardingMock.mockResolvedValue(true)

    await loadBackgroundModule()
    const listener = onInstalled.getListener()

    expect(listener).toBeTypeOf('function')

    await listener?.({ reason: 'install' } as chrome.runtime.InstalledDetails)

    expect(storageLocalGetMock).toHaveBeenCalledWith('settings')
    expect(migrateSettingsMock).toHaveBeenCalledWith({ legacy: true })
    expect(saveSettingsMock).toHaveBeenCalledWith(settings)
    expect(startTrialMock).not.toHaveBeenCalled()
    expect(syncRulesMock).toHaveBeenCalledWith(
      settings.blockRules,
      expect.objectContaining({
        dailyStats: null,
        activeLocationIds: [],
      }),
    )
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules, {
      plan: 'pro',
      freeActiveRuleIds: ['rule-1'],
    })
    expect(shouldShowOnboardingMock).toHaveBeenCalledTimes(1)
    expect(getOnboardingUrlMock).toHaveBeenCalledTimes(1)
    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test/options.html?onboarding=true',
    })
  })

  it('migrates settings, syncs rules, and updates badge on update without install-only effects', async () => {
    const settings = {
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
    }
    getSettingsMock.mockResolvedValue(settings)
    migrateSettingsMock.mockReturnValue(settings)

    await loadBackgroundModule()
    const listener = onInstalled.getListener()

    await listener?.({ reason: 'update' } as chrome.runtime.InstalledDetails)

    expect(storageLocalGetMock).toHaveBeenCalledWith('settings')
    expect(migrateSettingsMock).toHaveBeenCalledWith(baseSettings)
    expect(saveSettingsMock).toHaveBeenCalledWith(settings)
    expect(startTrialMock).not.toHaveBeenCalled()
    expect(syncRulesMock).toHaveBeenCalledWith(
      settings.blockRules,
      expect.objectContaining({
        dailyStats: null,
        activeLocationIds: [],
      }),
    )
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules, {
      plan: 'pro',
      freeActiveRuleIds: ['rule-1'],
    })
    expect(shouldShowOnboardingMock).not.toHaveBeenCalled()
    expect(tabsCreateMock).not.toHaveBeenCalled()
  })

  it('syncs rules and updates badge when local settings change', async () => {
    await loadBackgroundModule()
    const listener = onChanged.getListener()
    const settings = {
      ...baseSettings,
      blockRules: [makeRule({ id: 'rule-2', url: 'x.com' })],
      freeActiveRuleIds: ['rule-2'],
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

    expect(syncRulesMock).toHaveBeenCalledWith(
      settings.blockRules,
      expect.objectContaining({
        dailyStats: null,
        activeLocationIds: [],
      }),
    )
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules, {
      plan: 'pro',
      freeActiveRuleIds: ['rule-2'],
    })
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
    expect(updateBadgeMock).not.toHaveBeenCalled()
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

  it('returns delay gate decisions for matching hostnames', async () => {
    isTrialActiveMock.mockResolvedValue(true)
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [
        makeRule({
          restrictions: [{ type: 'delay', delaySeconds: 12 }],
        }),
      ],
      freeActiveRuleIds: ['rule-1'],
    })

    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({ type: 'delay:should-gate', hostname: 'youtube.com' }),
    ).resolves.toEqual({
      ok: true,
      gate: {
        ruleId: 'rule-1',
        delaySeconds: 12,
        matchedDomain: 'youtube.com',
      },
    })
  })

  it('returns screen time status for tracked hostnames', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
    })
    getBackgroundStateMock.mockResolvedValue({
      ...structuredClone(DEFAULT_BACKGROUND_STATE),
      dailyStats: {
        date: '2026-03-16',
        counts: {},
        durations: {
          'youtube.com': 23,
        },
      },
    })

    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({ type: 'screen-time:check', hostname: 'youtube.com' }),
    ).resolves.toEqual({
      tracked: true,
      todayMinutes: 23,
      goalMinutes: null,
    })
  })

  it('returns tracked false for hostnames outside the block list', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
    })

    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({ type: 'screen-time:check', hostname: 'github.com' }),
    ).resolves.toEqual({
      tracked: false,
      todayMinutes: 0,
      goalMinutes: null,
    })
  })

  it('returns goal minutes when the screen time goal is enabled', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
      screenTimeGoal: {
        enabled: true,
        dailyLimitMinutes: 45,
      },
    })

    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({ type: 'screen-time:check', hostname: 'youtube.com' }),
    ).resolves.toEqual({
      tracked: true,
      todayMinutes: 0,
      goalMinutes: 45,
    })
  })

  it('records screen time heartbeat deltas and returns the updated snapshot', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [makeRule()],
      freeActiveRuleIds: ['rule-1'],
      screenTimeGoal: {
        enabled: false,
        dailyLimitMinutes: 45,
      },
    })
    getBackgroundStateMock.mockResolvedValue({
      ...structuredClone(DEFAULT_BACKGROUND_STATE),
      dailyStats: {
        date: '2026-03-16',
        counts: {},
        durations: {
          'youtube.com': 23,
        },
      },
    })

    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({
        type: 'screen-time:heartbeat',
        hostname: 'youtube.com',
        sessionId: 'session-1',
        sessionMs: 30_000,
      }),
    ).resolves.toEqual({
      ok: true,
      todayMinutes: 23.5,
      goalMinutes: null,
    })
    expect(saveDailyStatsMock).toHaveBeenCalledWith({
      date: '2026-03-16',
      counts: {},
      durations: {
        'youtube.com': 23.5,
      },
    })
    expect(syncRulesMock).toHaveBeenCalled()
  })

  it('starts a temporary bypass and persists the entry', async () => {
    const module = await loadBackgroundModule()

    await expect(
      module.handleRuntimeMessage({
        type: 'bypass:start',
        ruleId: 'rule-1',
        durationMinutes: 5,
      }),
    ).resolves.toEqual({
      ok: true,
      entry: expect.objectContaining({
        ruleId: 'rule-1',
      }),
    })

    expect(saveBypassStateMock).toHaveBeenCalledWith({
      entries: [
        expect.objectContaining({
          ruleId: 'rule-1',
        }),
      ],
    })
  })
})
