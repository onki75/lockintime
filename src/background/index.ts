import {
  getBackgroundState,
  getDeletedMap,
  getSettings,
  getSyncState,
  resetDailyStats,
  saveAuthState,
  saveBackgroundState,
  saveBypassState,
  saveCooldownState,
  saveDailyStats,
  saveLocationState,
  saveSettings,
  saveSyncState,
} from '../lib/storage'
import type {
  AuthState,
  BlockRule,
  CooldownState,
  DailyStats,
  LocationState,
  Settings,
} from '../lib/types'
import { DEFAULT_SYNC_STATE } from '../lib/defaults'
import { startTrial } from '../lib/trial'
import { updateBadge } from '../lib/badge'
import { migrateSettings } from '../lib/migration'
import { getOnboardingUrl, shouldShowOnboarding } from '../lib/onboarding'
import { syncRules } from '../lib/rules'
import { createSyncService, createFirestoreSyncRemoteAdapter, type LocalSyncSnapshot } from '../lib/sync'
import { hasCloudSyncAccess } from '../lib/license'
import { observeAuthState, signInWithGoogle, signOutFromGoogle } from '../lib/auth'
import { createBypassEntry, pruneExpiredBypasses, upsertBypassEntry } from './runtime-state'
import { getDelayGateForHostname, type RuleEvaluationContext } from './rule-engine'
import { createTabTracker } from './tab-tracker'
import { createDailyStatsForDate, recordNavigationAccess } from './access-counter'
import { projectLocationState, type Coordinates } from './location-checker'

const DAILY_RESET_ALARM = 'daily-reset'
const COOLDOWN_ALARM_PREFIX = 'cooldown:'
const LOCATION_REFRESH_ALARM = 'location-refresh'
const LOCATION_REFRESH_MINUTES = 5
const LOCATION_OFFSCREEN_PATH = 'offscreen.html'
const MINUTES_PER_DAY = 24 * 60

let initialized = false
let activeSyncService:
  | ReturnType<typeof createSyncService>
  | null = null
let activeSyncUserId: string | null = null
let activeTabTracker: ReturnType<typeof createTabTracker> | null = null

type RuntimeMessage =
  | { type: 'auth:sign-in' }
  | { type: 'auth:sign-out' }
  | { type: 'sync:force' }
  | { type: 'sync:status' }
  | { type: 'delay:should-gate'; hostname: string }
  | { type: 'bypass:start'; ruleId: string; durationMinutes: number }
  | { type: 'location:refresh'; coordinates?: Coordinates }
  | { type: 'location:state' }

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function createEmptyDailyStats(date = new Date()): DailyStats {
  return {
    date: formatLocalDate(date),
    counts: {},
    durations: {},
  }
}

function getNextLocalMidnight(from = new Date()): number {
  const nextMidnight = new Date(from)
  nextMidnight.setHours(24, 0, 0, 0)
  return nextMidnight.getTime()
}

function getCooldownDurationMinutes(rule: BlockRule): number | null {
  const restriction = rule.restrictions.find((value) => value.type === 'cooldown')
  return restriction?.type === 'cooldown' ? restriction.cooldownMinutes : null
}

function getCooldownAlarmTime(
  rule: BlockRule,
  cooldownState: CooldownState,
  now = Date.now(),
): number | null {
  const cooldownMinutes = getCooldownDurationMinutes(rule)
  const lastAccess = cooldownState.lastAccess[rule.id]

  if (cooldownMinutes == null || lastAccess == null) {
    return null
  }

  const when = lastAccess + cooldownMinutes * 60 * 1000
  return when > now ? when : null
}

function scheduleDailyResetAlarm(now = new Date()): void {
  chrome.alarms.create(DAILY_RESET_ALARM, {
    when: getNextLocalMidnight(now),
    periodInMinutes: MINUTES_PER_DAY,
  })
}

function scheduleLocationRefreshAlarm(): void {
  chrome.alarms.create(LOCATION_REFRESH_ALARM, {
    periodInMinutes: LOCATION_REFRESH_MINUTES,
  })
}

function restoreCooldownAlarms(
  settings: Settings,
  cooldownState: CooldownState,
  now = Date.now(),
): void {
  for (const rule of settings.blockRules) {
    const when = getCooldownAlarmTime(rule, cooldownState, now)

    if (when == null) {
      continue
    }

    chrome.alarms.create(`${COOLDOWN_ALARM_PREFIX}${rule.id}`, { when })
  }
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

function getLatestDailyStats(
  dailyStatsHistory: Record<string, DailyStats>,
): DailyStats | null {
  const dates = [...Object.keys(dailyStatsHistory)].sort()
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : undefined
  return latestDate ? dailyStatsHistory[latestDate] : null
}

async function loadLocalSyncSnapshot(): Promise<LocalSyncSnapshot> {
  const [settings, backgroundState, deletedMap] = await Promise.all([
    getSettings(),
    getBackgroundState(),
    getDeletedMap(),
  ])

  return {
    settings,
    streakData: backgroundState.streakData,
    dailyStatsHistory: backgroundState.dailyStatsHistory,
    cooldownState: backgroundState.cooldownState,
    deletedMap,
  }
}

async function saveMergedSyncSnapshot(snapshot: LocalSyncSnapshot): Promise<void> {
  const backgroundState = await getBackgroundState()

  await saveSettings(snapshot.settings)
  await chrome.storage.local.set({ deletedMap: snapshot.deletedMap })
  await saveBackgroundState({
    ...backgroundState,
    dailyStats: getLatestDailyStats(snapshot.dailyStatsHistory),
    dailyStatsHistory: snapshot.dailyStatsHistory,
    cooldownState: snapshot.cooldownState,
    streakData: snapshot.streakData,
  })
}

async function updateStoredSyncState(
  syncState: Awaited<ReturnType<typeof getSyncState>>,
): Promise<void> {
  await saveSyncState(syncState)
}

async function triggerCloudSyncIfActive(): Promise<void> {
  if (!activeSyncService) {
    return
  }

  const syncState = await getSyncState()
  if (syncState.isApplyingRemote) {
    return
  }

  await activeSyncService.forceSync()
}

async function stopCloudSync(): Promise<void> {
  activeSyncService?.stop()
  activeSyncService = null
  activeSyncUserId = null
  await updateStoredSyncState({
    ...DEFAULT_SYNC_STATE,
    status: 'disabled',
  })
}

async function startCloudSync(userId: string): Promise<void> {
  if (activeSyncService && activeSyncUserId === userId) {
    return
  }

  await stopCloudSync()

  const remote = createFirestoreSyncRemoteAdapter()
  if (!remote) {
    return
  }

  activeSyncUserId = userId
  activeSyncService = createSyncService({
    userId,
    remote,
    loadLocalSnapshot: loadLocalSyncSnapshot,
    saveMergedSnapshot: saveMergedSyncSnapshot,
    updateSyncState: updateStoredSyncState,
  })

  await activeSyncService.start()
}

async function reconcileCloudSync(authState: AuthState): Promise<void> {
  if (authState.status !== 'authenticated' || !authState.user) {
    await stopCloudSync()
    return
  }

  if (!(await hasCloudSyncAccess())) {
    await stopCloudSync()
    return
  }

  await startCloudSync(authState.user.uid)
}

async function handleObservedAuthState(authState: AuthState): Promise<void> {
  await saveAuthState(authState)
  await reconcileCloudSync(authState)
}

async function migrateStoredSettings(): Promise<void> {
  const { settings } = (await chrome.storage.local.get('settings')) as {
    settings?: unknown
  }

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

function scheduleCooldownAlarmForRule(
  rule: BlockRule,
  cooldownState: CooldownState,
  now = Date.now(),
): void {
  const when = getCooldownAlarmTime(rule, cooldownState, now)
  if (when === null) {
    return
  }

  chrome.alarms.create(`${COOLDOWN_ALARM_PREFIX}${rule.id}`, { when })
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

type OffscreenContext = {
  documentUrl?: string
}

type RuntimeWithContexts = typeof chrome.runtime & {
  getContexts?: (filter: {
    contextTypes?: string[]
    documentUrls?: string[]
  }) => Promise<OffscreenContext[]>
}

async function ensureLocationOffscreenDocument(): Promise<boolean> {
  if (!('offscreen' in chrome) || !chrome.offscreen?.createDocument) {
    return false
  }

  const runtime = chrome.runtime as RuntimeWithContexts
  const documentUrl = chrome.runtime.getURL(LOCATION_OFFSCREEN_PATH)

  if (runtime.getContexts) {
    const contexts = await runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [documentUrl],
    })

    if (contexts.length > 0) {
      return true
    }
  }

  await chrome.offscreen.createDocument({
    url: LOCATION_OFFSCREEN_PATH,
    reasons: ['GEOLOCATION'],
    justification: 'Refresh location-based blocking rules in the background',
  })
  return true
}

async function requestCoordinatesFromOffscreen(): Promise<Coordinates> {
  const ready = await ensureLocationOffscreenDocument()
  if (!ready) {
    throw new Error('Offscreen geolocation is unavailable')
  }

  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'location-offscreen' })
    const timeout = globalThis.setTimeout(() => {
      port.disconnect()
      reject(new Error('Location request timed out'))
    }, 12_000)

    port.onMessage.addListener((message: { ok?: boolean; coordinates?: Coordinates; error?: string }) => {
      clearTimeout(timeout)
      port.disconnect()

      if (message.ok && message.coordinates) {
        resolve(message.coordinates)
        return
      }

      reject(new Error(message.error ?? 'Failed to resolve current location'))
    })

    port.postMessage({ type: 'location:get-current' })
  })
}

async function refreshLocationState(
  coordinates?: Coordinates,
): Promise<LocationState> {
  const settings = await getSettings()
  const now = Date.now()

  try {
    const resolvedCoordinates = coordinates ?? await requestCoordinatesFromOffscreen()
    const locationState = projectLocationState(settings.locations, resolvedCoordinates, { now })

    await saveLocationState(locationState)
    await syncCurrentRules()
    await triggerCloudSyncIfActive()

    return locationState
  } catch (error) {
    const locationState = projectLocationState(settings.locations, null, {
      now,
      error: (error as Error).message,
    })

    await saveLocationState(locationState)
    await syncCurrentRules()
    return locationState
  }
}

export async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
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
}

export async function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): Promise<void> {
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
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === LOCATION_REFRESH_ALARM) {
    await refreshLocationState()
    return
  }

  if (alarm.name !== DAILY_RESET_ALARM) {
    return
  }

  await resetDailyStats(createEmptyDailyStats())
  await syncCurrentRules()

  if (activeSyncService) {
    await triggerCloudSyncIfActive()
  }
}

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
    void handleRuntimeMessage(message as RuntimeMessage)
      .then((value) => sendResponse(value))
      .catch((error) => sendResponse({ ok: false, error: (error as Error).message }))

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

export async function handleRuntimeMessage(
  message: RuntimeMessage,
): Promise<unknown> {
  switch (message.type) {
    case 'auth:sign-in': {
      const user = await signInWithGoogle()
      const authState: AuthState = {
        status: 'authenticated',
        user,
        lastError: null,
      }

      await saveAuthState(authState)
      await reconcileCloudSync(authState)
      return { ok: true, user }
    }
    case 'auth:sign-out': {
      await signOutFromGoogle()
      await handleObservedAuthState({
        status: 'anonymous',
        user: null,
        lastError: null,
      })
      return { ok: true }
    }
    case 'sync:force': {
      if (!activeSyncService) {
        return { ok: false, status: 'disabled' }
      }

      await activeSyncService.forceSync()
      return { ok: true }
    }
    case 'sync:status':
      return getSyncState()
    case 'delay:should-gate': {
      const [settings, backgroundState] = await Promise.all([
        getSettings(),
        getBackgroundState(),
      ])
      const decision = getDelayGateForHostname(
        message.hostname,
        settings.blockRules,
        toRuleEvaluationContext(backgroundState),
      )

      return {
        ok: true,
        gate: decision,
      }
    }
    case 'bypass:start': {
      const backgroundState = await getBackgroundState()
      const bypassState = pruneExpiredBypasses(backgroundState.bypassState)
      const entry = createBypassEntry(message.ruleId, message.durationMinutes)
      const nextBypassState = upsertBypassEntry(bypassState, entry)

      await saveBypassState(nextBypassState)
      await syncCurrentRules()

      return {
        ok: true,
        entry,
      }
    }
    case 'location:refresh': {
      const locationState = await refreshLocationState(message.coordinates)
      return {
        ok: true,
        locationState,
      }
    }
    case 'location:state': {
      const backgroundState = await getBackgroundState()
      return {
        ok: true,
        locationState: backgroundState.locationState,
      }
    }
    default:
      return { ok: false, error: 'Unknown message' }
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
