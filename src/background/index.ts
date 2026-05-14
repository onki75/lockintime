import {
  getBackgroundState,
  getBlockedDomains,
  getSettings,
  resetDailyStats,
  saveCooldownState,
  saveSessionState,
  saveSettings,
  saveStreakData,
  updateDailyStats,
} from '../lib/storage'
import type { Settings } from '../lib/types'
import { commitDayStreak, markStreakBypass } from '../lib/streak-recorder'
import { resolveEffectiveLicensePlan } from '../lib/license'
import { getActiveRules, resolveRulePlanState } from '../lib/rule-activation'
import { isTrialActive } from '../lib/trial'
import { updateBadge } from '../lib/badge'
import { migrateSettings } from '../lib/migration'
import { getOnboardingUrl, shouldShowOnboarding } from '../lib/onboarding'
import { syncRules } from '../lib/rules'
import { pruneExpiredBypasses } from './runtime-state'
import { type RuleEvaluationContext } from './rule-engine'
import {
  addSessionElapsed,
  endSession,
  hasSessionExpired,
} from './session-manager'
import { DEFAULT_SESSION_STATE } from '../lib/defaults'
import { createTabTracker } from './tab-tracker'
import {
  getHostnameFromUrl,
  getMatchedDomainsForHostname,
  recordNavigationAccess,
  recordDurationForHostname,
  type NavigationTrackingResult,
} from './access-counter'

import {
  COOLDOWN_ALARM_PREFIX,
  DAILY_RESET_ALARM,
  LOCATION_REFRESH_ALARM,
  TEMPORAL_RULE_REFRESH_ALARM,
  createEmptyDailyStats,
  formatLocalDate,
  getNextLocalMidnight,
  scheduleDailyResetAlarm,
  scheduleLocationRefreshAlarm,
  scheduleTemporalRuleRefreshAlarm,
  restoreCooldownAlarms,
  scheduleCooldownAlarmForRule,
} from './alarms'

import { refreshLocationState } from './location'

import { createMessageHandler, type RuntimeMessage } from './message-handler'

let initialized = false
let activeTabTracker: ReturnType<typeof createTabTracker> | null = null
const ADULT_FILTER_RULESET_ID = 'adult_filter'

function getGoalMinutes(settings: Settings): number | null {
  return settings.screenTimeGoal.enabled
    ? settings.screenTimeGoal.dailyLimitMinutes
    : null
}

function getTodayMinutesForDomains(
  durations: Record<string, number>,
  domains: string[],
): number {
  return domains.reduce((total, domain) => total + (durations[domain] ?? 0), 0)
}

async function getActiveRulesForBackgroundState(
  settings: Settings,
  backgroundState: Awaited<ReturnType<typeof getBackgroundState>>,
) {
  const rulePlan = resolveRulePlanState({
    trialActive: await isTrialActive(),
    licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
  })

  return getActiveRules(settings.blockRules, {
    plan: rulePlan,
    freeActiveRuleIds: settings.freeActiveRuleIds,
  })
}

function toRuleEvaluationContext(
  backgroundState: Awaited<ReturnType<typeof getBackgroundState>>,
): RuleEvaluationContext {
  return {
    dailyStats: backgroundState.dailyStats,
    cooldownState: backgroundState.cooldownState,
    bypassState: pruneExpiredBypasses(backgroundState.bypassState),
    sessionState: backgroundState.sessionState,
    activeLocationIds: backgroundState.locationState.activeLocationIds,
  }
}

async function syncCurrentRules(): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])
  const rulePlan = resolveRulePlanState({
    trialActive: await isTrialActive(),
    licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
  })
  const activeRules = getActiveRules(settings.blockRules, {
    plan: rulePlan,
    freeActiveRuleIds: settings.freeActiveRuleIds,
  })

  await syncRules(activeRules, toRuleEvaluationContext(backgroundState))
  await syncAdultFilterRuleset(settings.adultFilter)
  updateBadge(settings.blockRules, {
    plan: rulePlan,
    freeActiveRuleIds: settings.freeActiveRuleIds,
  })
}

async function recordScreenTimeHeartbeat(
  hostname: string,
  elapsedMs: number,
): Promise<{
  tracked: boolean
  todayMinutes: number
  goalMinutes: number | null
  activeSession: { ruleId: string; remainingMs: number; perSessionMinutes: number } | null
}> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])
  const activeRules = await getActiveRulesForBackgroundState(settings, backgroundState)
  const { domains, ruleIds } = getMatchedDomainsForHostname(hostname, activeRules)
  const nextDailyStats = await updateDailyStats((currentDailyStats) =>
    recordDurationForHostname(
      hostname,
      activeRules,
      currentDailyStats,
      elapsedMs,
      new Date(),
    ),
  )

  const { expired: sessionExpired, sessionState: latestSessionState } = await tickActiveSessions(
    backgroundState.sessionState,
    activeRules,
    ruleIds,
    elapsedMs,
    nextDailyStats ?? backgroundState.dailyStats,
  )

  if (nextDailyStats || sessionExpired) {
    await syncCurrentRules()
    activeTabTracker?.markRecorded(hostname)
  }

  return {
    tracked: domains.length > 0,
    todayMinutes: getTodayMinutesForDomains(
      nextDailyStats?.durations ?? backgroundState.dailyStats?.durations ?? {},
      domains,
    ),
    goalMinutes: getGoalMinutes(settings),
    activeSession: getMostRestrictiveActiveSession(latestSessionState, activeRules, ruleIds),
  }
}

function getMostRestrictiveActiveSession(
  sessionState: Awaited<ReturnType<typeof getBackgroundState>>['sessionState'],
  activeRules: ReturnType<typeof getActiveRules>,
  matchedRuleIds: string[],
): { ruleId: string; remainingMs: number; perSessionMinutes: number } | null {
  let result: { ruleId: string; remainingMs: number; perSessionMinutes: number } | null = null

  for (const ruleId of matchedRuleIds) {
    const rule = activeRules.find((r) => r.id === ruleId)
    if (!rule) continue

    const dailyCount = rule.restrictions.find(
      (r): r is Extract<typeof r, { type: 'daily_count' }> => r.type === 'daily_count',
    )
    if (!dailyCount) continue

    const session = sessionState.active[ruleId]
    if (!session) continue

    const remainingMs = Math.max(
      0,
      dailyCount.perSessionMinutes * 60_000 - session.elapsedMs,
    )
    if (result === null || remainingMs < result.remainingMs) {
      result = { ruleId, remainingMs, perSessionMinutes: dailyCount.perSessionMinutes }
    }
  }

  return result
}

async function tickActiveSessions(
  currentSessionState: Awaited<ReturnType<typeof getBackgroundState>>['sessionState'],
  activeRules: ReturnType<typeof getActiveRules>,
  matchedRuleIds: string[],
  elapsedMs: number,
  dailyStatsSnapshot: Awaited<ReturnType<typeof getBackgroundState>>['dailyStats'],
): Promise<{
  expired: boolean
  sessionState: Awaited<ReturnType<typeof getBackgroundState>>['sessionState']
}> {
  if (matchedRuleIds.length === 0) {
    return { expired: false, sessionState: currentSessionState }
  }

  const now = Date.now()
  let nextSessionState = currentSessionState
  const expiredRules: {
    id: string
    domains: string[]
    subReason: 'exhausted' | 'session_gate'
  }[] = []

  for (const ruleId of matchedRuleIds) {
    const rule = activeRules.find((r) => r.id === ruleId)
    if (!rule) continue

    const dailyCount = rule.restrictions.find(
      (r): r is Extract<typeof r, { type: 'daily_count' }> => r.type === 'daily_count',
    )
    if (!dailyCount) continue

    const currentSession = nextSessionState.active[ruleId]
    if (!currentSession) continue

    nextSessionState = addSessionElapsed(nextSessionState, ruleId, elapsedMs, now)
    const updated = nextSessionState.active[ruleId]
    if (updated && hasSessionExpired(updated, dailyCount.perSessionMinutes, now)) {
      nextSessionState = endSession(nextSessionState, ruleId)
      const sessionCount = dailyStatsSnapshot?.sessionCounts?.[ruleId] ?? 0
      const subReason: 'exhausted' | 'session_gate' =
        sessionCount >= dailyCount.maxCount ? 'exhausted' : 'session_gate'
      expiredRules.push({ id: ruleId, domains: getBlockedDomains(rule), subReason })
    }
  }

  if (nextSessionState !== currentSessionState) {
    await saveSessionState(nextSessionState)
  }

  if (expiredRules.length > 0) {
    await Promise.all(
      expiredRules.flatMap(({ id, domains: ruleDomains, subReason }) =>
        ruleDomains.map((domain) => forceBlockTabsForDomain(domain, id, subReason)),
      ),
    )
  }

  return { expired: expiredRules.length > 0, sessionState: nextSessionState }
}

async function forceBlockTabsForDomain(
  domain: string,
  ruleId: string,
  subReason: 'exhausted' | 'session_gate',
): Promise<void> {
  const params = new URLSearchParams({
    url: domain,
    ruleId,
    reason: 'daily_count',
    subReason,
  })
  const blockedUrl = `${chrome.runtime.getURL('blocked.html')}?${params.toString()}`

  try {
    const matchingTabs = await queryTabs({
      url: [`*://${domain}/*`, `*://*.${domain}/*`],
    })

    await Promise.all(
      matchingTabs.map((tab) => {
        if (tab.id == null) return Promise.resolve()
        return new Promise<void>((resolve) => {
          chrome.tabs.update(tab.id!, { url: blockedUrl }, () => {
            void chrome.runtime.lastError
            resolve()
          })
        })
      }),
    )
  } catch (error) {
    console.warn('[LockInTime] forceBlockTabsForDomain failed', error)
  }
}

async function syncAdultFilterRuleset(enabled: boolean): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [ADULT_FILTER_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [ADULT_FILTER_RULESET_ID],
  })
}

async function restoreAlarms(): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])

  scheduleDailyResetAlarm()
  scheduleLocationRefreshAlarm()
  scheduleTemporalRuleRefreshAlarm()
  restoreCooldownAlarms(settings, backgroundState.cooldownState)
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

async function handleNavigationCommitted(url: string): Promise<void> {
  const hostname = getHostnameFromUrl(url)
  if (!hostname) {
    return
  }

  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])
  const rulePlan = resolveRulePlanState({
    trialActive: await isTrialActive(),
    licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
  })
  const activeRules = getActiveRules(settings.blockRules, {
    plan: rulePlan,
    freeActiveRuleIds: settings.freeActiveRuleIds,
  })

  const { domains } = getMatchedDomainsForHostname(hostname, activeRules)
  if (domains.length === 0) {
    return
  }

  const captured: { value: NavigationTrackingResult | null } = { value: null }
  const nextDailyStats = await updateDailyStats((currentDailyStats) => {
    const tracked = recordNavigationAccess(
      url,
      activeRules,
      currentDailyStats,
      backgroundState.cooldownState,
      new Date(),
    )
    captured.value = tracked
    return tracked?.dailyStats ?? null
  })

  const result = captured.value
  if (!nextDailyStats || !result) {
    return
  }

  await saveCooldownState(result.cooldownState)

  for (const rule of settings.blockRules) {
    if (result.matchedRuleIds.includes(rule.id)) {
      scheduleCooldownAlarmForRule(rule, result.cooldownState)
    }
  }

  await syncCurrentRules()
}

export async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  try {
    if (details.reason !== 'install' && details.reason !== 'update') {
      return
    }

    await migrateStoredSettings()
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
      const rulePlan = resolveRulePlanState({
        trialActive: await isTrialActive(),
        licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
      })
      const activeRules = getActiveRules(settings.blockRules, {
        plan: rulePlan,
        freeActiveRuleIds: settings.freeActiveRuleIds,
      })
      await syncRules(activeRules, toRuleEvaluationContext(backgroundState))
      await syncAdultFilterRuleset(settings.adultFilter)
      updateBadge(settings.blockRules, {
        plan: rulePlan,
        freeActiveRuleIds: settings.freeActiveRuleIds,
      })
    }
  } catch (error) {
    console.error('[LockInTime] onChanged error:', error)
  }
}

async function commitElapsedDayStreak(): Promise<void> {
  const [settings, backgroundState] = await Promise.all([
    getSettings(),
    getBackgroundState(),
  ])

  const elapsedStats = backgroundState.dailyStats
  if (!elapsedStats) {
    return
  }

  const nextStreakData = commitDayStreak(
    backgroundState.streakData,
    elapsedStats.date,
    elapsedStats,
    settings.screenTimeGoal,
    Date.now(),
  )

  if (nextStreakData !== backgroundState.streakData) {
    await saveStreakData(nextStreakData)
  }
}

async function recordBypassStreak(): Promise<void> {
  const backgroundState = await getBackgroundState()
  const today = formatLocalDate(new Date())
  const nextStreakData = markStreakBypass(backgroundState.streakData, today, Date.now())

  if (nextStreakData !== backgroundState.streakData) {
    await saveStreakData(nextStreakData)
  }
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  try {
    if (alarm.name === LOCATION_REFRESH_ALARM) {
      await refreshLocationState(undefined, syncCurrentRules)
      return
    }

    if (
      alarm.name === TEMPORAL_RULE_REFRESH_ALARM ||
      alarm.name.startsWith(COOLDOWN_ALARM_PREFIX)
    ) {
      await syncCurrentRules()
      return
    }

    if (alarm.name !== DAILY_RESET_ALARM) {
      return
    }

    await commitElapsedDayStreak()
    await resetDailyStats(createEmptyDailyStats())
    await saveSessionState({ ...DEFAULT_SESSION_STATE, active: {} })
    await syncCurrentRules()
  } catch (error) {
    console.error('[LockInTime] onAlarm error:', error)
  }
}

const handleRuntimeMessage = createMessageHandler({
  syncCurrentRules,
  refreshLocationState: (coordinates) =>
    refreshLocationState(coordinates, syncCurrentRules),
  getScreenTimeStatus: async (hostname) => {
    const [settings, backgroundState] = await Promise.all([
      getSettings(),
      getBackgroundState(),
    ])
    const activeRules = await getActiveRulesForBackgroundState(settings, backgroundState)
    const { domains, ruleIds } = getMatchedDomainsForHostname(hostname, activeRules)

    return {
      tracked: domains.length > 0,
      todayMinutes: getTodayMinutesForDomains(
        backgroundState.dailyStats?.durations ?? {},
        domains,
      ),
      goalMinutes: getGoalMinutes(settings),
      activeSession: getMostRestrictiveActiveSession(
        backgroundState.sessionState,
        activeRules,
        ruleIds,
      ),
    }
  },
  recordScreenTimeHeartbeat,
  recordBypassStreak,
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
    recordDuration: async (hostname, durationMs, now) => {
      const [settings, backgroundState] = await Promise.all([
        getSettings(),
        getBackgroundState(),
      ])
      const rulePlan = resolveRulePlanState({
        trialActive: await isTrialActive(),
        licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
      })

      const activeRules = getActiveRules(settings.blockRules, {
        plan: rulePlan,
        freeActiveRuleIds: settings.freeActiveRuleIds,
      })

      return updateDailyStats((currentDailyStats) =>
        recordDurationForHostname(
          hostname,
          activeRules,
          currentDailyStats,
          durationMs,
          new Date(now),
        ),
      )
    },
    syncRules: syncCurrentRules,
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
}

const backgroundReady = initializeBackgroundServiceWorker()
void backgroundReady.catch((error) => {
  console.error('LockInTime: background initialization failed', error)
})

export {
  COOLDOWN_ALARM_PREFIX,
  DAILY_RESET_ALARM,
  LOCATION_REFRESH_ALARM,
  TEMPORAL_RULE_REFRESH_ALARM,
  backgroundReady,
  createEmptyDailyStats,
  formatLocalDate,
  getNextLocalMidnight,
}
