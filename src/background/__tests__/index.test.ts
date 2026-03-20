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
const startTrialMock = vi.fn(async () => undefined)
const migrateSettingsMock = vi.fn<(value: unknown) => Settings>()
const shouldShowOnboardingMock = vi.fn<() => Promise<boolean>>()
const getOnboardingUrlMock = vi.fn(() => 'chrome-extension://test/options.html?onboarding=true')
const getSettingsMock = vi.fn<() => Promise<Settings>>()
const getBackgroundStateMock = vi.fn<() => Promise<BackgroundState>>()
const getSyncStateMock = vi.fn<() => Promise<BackgroundState['syncState']>>()
const saveSettingsMock = vi.fn<(settings: Settings) => Promise<void>>()
const saveAuthStateMock = vi.fn<(state: BackgroundState['authState']) => Promise<void>>()
const saveBackgroundStateMock = vi.fn<(state: BackgroundState) => Promise<void>>()
const saveBypassStateMock = vi.fn<(state: BackgroundState['bypassState']) => Promise<void>>()
const saveSyncStateMock = vi.fn<(state: BackgroundState['syncState']) => Promise<void>>()
const resetDailyStatsMock = vi.fn<(stats: DailyStats) => Promise<void>>()
const observeAuthStateMock = vi.fn()
const signInWithGoogleMock = vi.fn()
const signOutFromGoogleMock = vi.fn(async () => undefined)
const hasCloudSyncAccessMock = vi.fn<() => Promise<boolean>>()
const createFirestoreSyncRemoteAdapterMock = vi.fn()
const syncServiceStartMock = vi.fn(async () => undefined)
const syncServiceForceSyncMock = vi.fn(async () => undefined)
const syncServiceStopMock = vi.fn()
const createSyncServiceMock = vi.fn(() => ({
  start: syncServiceStartMock,
  forceSync: syncServiceForceSyncMock,
  stop: syncServiceStopMock,
}))

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
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
  uiMode: 'mascot',
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
    enabled: true,
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
      getSyncState: getSyncStateMock,
      saveAuthState: saveAuthStateMock,
      saveBackgroundState: saveBackgroundStateMock,
      saveBypassState: saveBypassStateMock,
      saveSettings: saveSettingsMock,
      saveSyncState: saveSyncStateMock,
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
    startTrial: startTrialMock,
  }))

  vi.doMock('../../lib/migration', () => ({
    migrateSettings: migrateSettingsMock,
  }))

  vi.doMock('../../lib/onboarding', () => ({
    shouldShowOnboarding: shouldShowOnboardingMock,
    getOnboardingUrl: getOnboardingUrlMock,
  }))

  vi.doMock('../../lib/auth', () => ({
    observeAuthState: observeAuthStateMock,
    signInWithGoogle: signInWithGoogleMock,
    signOutFromGoogle: signOutFromGoogleMock,
  }))

  vi.doMock('../../lib/license', () => ({
    hasCloudSyncAccess: hasCloudSyncAccessMock,
  }))

  vi.doMock('../../lib/sync', () => ({
    createFirestoreSyncRemoteAdapter: createFirestoreSyncRemoteAdapterMock,
    createSyncService: createSyncServiceMock,
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
  getSyncStateMock.mockResolvedValue(structuredClone(DEFAULT_BACKGROUND_STATE.syncState))
  migrateSettingsMock.mockImplementation((value) => value as Settings)
  shouldShowOnboardingMock.mockResolvedValue(false)
  saveSettingsMock.mockResolvedValue(undefined)
  saveAuthStateMock.mockResolvedValue(undefined)
  saveBackgroundStateMock.mockResolvedValue(undefined)
  saveBypassStateMock.mockResolvedValue(undefined)
  saveSyncStateMock.mockResolvedValue(undefined)
  resetDailyStatsMock.mockResolvedValue(undefined)
  observeAuthStateMock.mockImplementation(() => vi.fn())
  signInWithGoogleMock.mockResolvedValue({
    uid: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    photoURL: null,
  })
  hasCloudSyncAccessMock.mockResolvedValue(false)
  createFirestoreSyncRemoteAdapterMock.mockReturnValue({
    pull: vi.fn(async () => null),
    push: vi.fn(async () => undefined),
    subscribe: vi.fn(() => vi.fn()),
  })
  storageLocalGetMock.mockResolvedValue({ settings: baseSettings })
  getAlarmMock.mockResolvedValue(undefined)
  runtimeGetUrlMock.mockImplementation(
    (path: string) => `chrome-extension://test/${path}`,
  )
  getDynamicRulesMock.mockResolvedValue([])
  updateDynamicRulesMock.mockResolvedValue(undefined)
  syncServiceStartMock.mockResolvedValue(undefined)
  syncServiceForceSyncMock.mockResolvedValue(undefined)
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

  it('migrates settings, starts trial, syncs rules, updates badge, and opens onboarding on install', async () => {
    const settings = {
      ...baseSettings,
      blockRules: [makeRule()],
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
    expect(startTrialMock).toHaveBeenCalledTimes(1)
    expect(syncRulesMock).toHaveBeenCalledWith(
      settings.blockRules,
      expect.objectContaining({
        dailyStats: null,
        activeLocationIds: [],
      }),
    )
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules)
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
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules)
    expect(shouldShowOnboardingMock).not.toHaveBeenCalled()
    expect(tabsCreateMock).not.toHaveBeenCalled()
  })

  it('syncs rules and updates badge when local settings change', async () => {
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

    expect(syncRulesMock).toHaveBeenCalledWith(
      settings.blockRules,
      expect.objectContaining({
        dailyStats: null,
        activeLocationIds: [],
      }),
    )
    expect(updateBadgeMock).toHaveBeenCalledWith(settings.blockRules)
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

  it('starts cloud sync when auth becomes authenticated and the cached license allows it', async () => {
    hasCloudSyncAccessMock.mockResolvedValue(true)
    observeAuthStateMock.mockImplementation((callback: (state: BackgroundState['authState']) => void) => {
      callback({
        status: 'authenticated',
        user: {
          uid: 'user-1',
          email: 'user@example.com',
          displayName: 'User',
          photoURL: null,
        },
        lastError: null,
      })
      return vi.fn()
    })

    await loadBackgroundModule()

    expect(saveAuthStateMock).toHaveBeenCalledWith({
      status: 'authenticated',
      user: {
        uid: 'user-1',
        email: 'user@example.com',
        displayName: 'User',
        photoURL: null,
      },
      lastError: null,
    })
    expect(createSyncServiceMock).toHaveBeenCalledTimes(1)
    expect(syncServiceStartMock).toHaveBeenCalledTimes(1)
  })

  it('handles runtime auth sign-in messages', async () => {
    const module = await loadBackgroundModule()

    await expect(module.handleRuntimeMessage({ type: 'auth:sign-in' })).resolves.toEqual({
      ok: true,
      user: {
        uid: 'user-1',
        email: 'user@example.com',
        displayName: 'User',
        photoURL: null,
      },
    })

    expect(signInWithGoogleMock).toHaveBeenCalledTimes(1)
  })

  it('returns delay gate decisions for matching hostnames', async () => {
    getSettingsMock.mockResolvedValue({
      ...baseSettings,
      blockRules: [
        makeRule({
          restrictions: [{ type: 'delay', delaySeconds: 12 }],
        }),
      ],
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
