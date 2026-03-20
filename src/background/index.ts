import {
  getBackgroundState,
  getSettings,
  resetDailyStats,
  saveCooldownState,
  saveDailyStats,
} from '../lib/storage'
import type { Settings } from '../lib/types'
import { startTrial } from '../lib/trial'
import { updateBadge } from '../lib/badge'
import { migrateSettings } from '../lib/migration'
import { getOnboardingUrl, shouldShowOnboarding } from '../lib/onboarding'
import { syncRules } from '../lib/rules'
import { observeAuthState } from '../lib/auth'
import { pruneExpiredBypasses } from './runtime-state'
import { type RuleEvaluationContext } from './rule-engine'
import { createTabTracker } from './tab-tracker'
import { createDailyStatsForDate, recordNavigationAccess } from './access-counter'

import {
  COOLDOWN_ALARM_PREFIX,
  DAILY_RESET_ALARM,
  LOCATION_REFRESH_ALARM,
  createEmptyDailyStats,
  formatLocalDate,
  getNextLocalMidnight,
  scheduleDailyResetAlarm,
  scheduleLocationRefreshAlarm,
  restoreCooldownAlarms,
  scheduleCooldownAlarmForRule,
} from './alarms'

import {
  triggerCloudSyncIfActive,
  handleObservedAuthState,
  getActiveSyncService,
} from './cloud-sync'

import { refreshLocationState } from './location'

import { createMessageHandler, type RuntimeMessage } from './message-handler'

let initialized = false
let activeTabTracker: ReturnType<typeof createTabTracker> | null = null

function toRuleEvaluationContext(
  backgroundState: Awaited<ReturnType<typeof getBackgroundState>>,
): RuleEvaluationContext {
  return {
    dailyStats: backgroundState.dailyStats,
    cooldownState: backgroundState.cooldownState,
    bypassState: pruneExpiredBypasses(backgroundState.bypassState),
    activeLocationIds: backgroundState.locationState.activeLocationIds,
  }
}

async function syncCurrentRules(): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])

  await syncRules(settings.blockRules, toRuleEvaluationContext(backgroundState))
  updateBadge(settings.blockRules)
}

async function restoreAlarms(): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])

  scheduleDailyResetAlarm()
  scheduleLocationRefreshAlarm()
  restoreCooldownAlarms(settings, backgroundState.cooldownState)
}

async function migrateStoredSettings(): Promise<void> {
  const { settings } = (await chrome.storage.local.get('settings')) as {
    settings?: unknown
  }

  const { saveSettings } = await import('../lib/storage')
  await saveSettings(migrateSettings(settings))
}

function getTabById(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError?.message
      if (error || !tab) {
        reject(new Error(error ?? 'Tab not found'))
        return
      }

      resolve(tab)
    })
  })
}

function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const error = chrome.runtime.lastError?.message
      if (error) {
        reject(new Error(error))
        return
      }

      resolve(tabs ?? [])
    })
  })
}

async function handleNavigationCommitted(url: string): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])
  const result = recordNavigationAccess(
    url,
    settings.blockRules,
    backgroundState.dailyStats,
    backgroundState.cooldownState,
    new Date(),
  )

  if (!result) {
    return
  }

  await Promise.all([
    saveDailyStats(result.dailyStats),
    saveCooldownState(result.cooldownState),
  ])

  for (const rule of settings.blockRules) {
    if (result.matchedRuleIds.includes(rule.id)) {
      scheduleCooldownAlarmForRule(rule, result.cooldownState)
    }
  }

  await syncCurrentRules()
  await triggerCloudSyncIfActive()
}

export async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  try {
    if (details.reason !== 'install' && details.reason !== 'update') {
      return
    }

    await migrateStoredSettings()
    if (details.reason === 'install') {
      await startTrial()
    }

    await syncCurrentRules()

    if (
      details.reason === 'install' &&
      (await shouldShowOnboarding())
    ) {
      await chrome.tabs.create({ url: getOnboardingUrl() })
    }
  } catch (error) {
    console.error('[LockInTime] onInstalled error:', error)
  }
}

export async function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): Promise<void> {
  try {
    if (areaName !== 'local') {
      return
    }

    if (changes.settings?.newValue) {
      const settings = changes.settings.newValue as Settings
      const backgroundState = await getBackgroundState()
      await syncRules(settings.blockRules, toRuleEvaluationContext(backgroundState))
      updateBadge(settings.blockRules)
    }

    if (changes.settings?.newValue || changes.deletedMap?.newValue) {
      await triggerCloudSyncIfActive()
    }
  } catch (error) {
    console.error('[LockInTime] onChanged error:', error)
  }
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  try {
    if (alarm.name === LOCATION_REFRESH_ALARM) {
      await refreshLocationState(undefined, syncCurrentRules, triggerCloudSyncIfActive)
      return
    }

    if (alarm.name !== DAILY_RESET_ALARM) {
      return
    }

    await resetDailyStats(createEmptyDailyStats())
    await syncCurrentRules()

    if (getActiveSyncService()) {
      await triggerCloudSyncIfActive()
    }
  } catch (error) {
    console.error('[LockInTime] onAlarm error:', error)
  }
}

const handleRuntimeMessage = createMessageHandler({
  syncCurrentRules,
  refreshLocationState: (coordinates) =>
    refreshLocationState(coordinates, syncCurrentRules, triggerCloudSyncIfActive),
})

export { handleRuntimeMessage }

export async function initializeBackgroundServiceWorker(): Promise<void> {
  if (initialized) {
    return
  }

  initialized = true

  chrome.runtime.onInstalled.addListener(handleInstalled)
  chrome.storage.onChanged.addListener(handleStorageChanged)
  chrome.alarms.onAlarm.addListener(handleAlarm)
  chrome.webNavigation?.onCommitted?.addListener((details) => {
    if (details.frameId !== 0) {
      return
    }

    void handleNavigationCommitted(details.url)
  })

  activeTabTracker = createTabTracker({
    getRules: async () => (await getSettings()).blockRules,
    getDailyStats: async () => (await getBackgroundState()).dailyStats ?? createDailyStatsForDate(),
    saveDailyStats,
    syncRules: async () => {
      await syncCurrentRules()
      await triggerCloudSyncIfActive()
    },
    getTab: getTabById,
    queryTabs,
  })

  chrome.tabs.onActivated?.addListener((activeInfo) => {
    void activeTabTracker?.handleActivated(activeInfo)
  })
  chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
    void activeTabTracker?.handleUpdated(tabId, changeInfo, tab)
  })
  chrome.tabs.onRemoved?.addListener((tabId) => {
    void activeTabTracker?.handleRemoved(tabId)
  })
  chrome.windows?.onFocusChanged?.addListener((windowId) => {
    void activeTabTracker?.handleWindowFocusChanged(windowId)
  })
  chrome.runtime.onSuspend?.addListener(() => {
    void activeTabTracker?.flush()
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      void handleRuntimeMessage(message as RuntimeMessage)
        .then((value) => sendResponse(value))
        .catch((error) => {
          console.error(error)
          sendResponse({ ok: false, error: (error as Error).message })
        })
    } catch (error) {
      console.error(error)
      sendResponse({ ok: false, error: (error as Error).message })
    }

    return true
  })

  await restoreAlarms()

  try {
    observeAuthState((authState) => {
      void handleObservedAuthState(authState)
    })
  } catch (error) {
    console.warn('LockInTime: auth observer unavailable', error)
  }
}

const backgroundReady = initializeBackgroundServiceWorker()
void backgroundReady.catch((error) => {
  console.error('LockInTime: background initialization failed', error)
})

export {
  COOLDOWN_ALARM_PREFIX,
  DAILY_RESET_ALARM,
  LOCATION_REFRESH_ALARM,
  backgroundReady,
  createEmptyDailyStats,
  formatLocalDate,
  getNextLocalMidnight,
}
