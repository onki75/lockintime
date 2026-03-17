import {
  getBackgroundState,
  getSettings,
  resetDailyStats,
  setTrialStartDate,
} from '../lib/storage'
import type {
  BlockRule,
  CooldownState,
  DailyStats,
  Settings,
} from '../lib/types'
import { syncRules } from '../lib/rules'

const DAILY_RESET_ALARM = 'daily-reset'
const COOLDOWN_ALARM_PREFIX = 'cooldown:'
const MINUTES_PER_DAY = 24 * 60

let initialized = false

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
  restoreCooldownAlarms(settings, backgroundState.cooldownState)
}

export async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  const settings = await getSettings()

  if (details.reason === 'install') {
    await setTrialStartDate(Date.now())
  }

  if (details.reason === 'install' || details.reason === 'update') {
    await syncRules(settings.blockRules)
  }
}

export async function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): Promise<void> {
  if (areaName !== 'local' || !changes.settings?.newValue) {
    return
  }

  const settings = changes.settings.newValue as Settings
  await syncRules(settings.blockRules)
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== DAILY_RESET_ALARM) {
    return
  }

  await resetDailyStats(createEmptyDailyStats())
}

export async function initializeBackgroundServiceWorker(): Promise<void> {
  if (initialized) {
    return
  }

  initialized = true

  chrome.runtime.onInstalled.addListener(handleInstalled)
  chrome.storage.onChanged.addListener(handleStorageChanged)
  chrome.alarms.onAlarm.addListener(handleAlarm)

  await restoreAlarms()
}

const backgroundReady = initializeBackgroundServiceWorker()
void backgroundReady.catch((error) => {
  console.error('LockInTime: background initialization failed', error)
})

export {
  COOLDOWN_ALARM_PREFIX,
  DAILY_RESET_ALARM,
  backgroundReady,
  createEmptyDailyStats,
  formatLocalDate,
  getNextLocalMidnight,
}
