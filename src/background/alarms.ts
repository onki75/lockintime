import type { BlockRule, CooldownState, DailyStats, Settings } from '../lib/types'

export const DAILY_RESET_ALARM = 'daily-reset'
export const COOLDOWN_ALARM_PREFIX = 'cooldown:'
export const LOCATION_REFRESH_ALARM = 'location-refresh'
export const TEMPORAL_RULE_REFRESH_ALARM = 'temporal-rule-refresh'

const LOCATION_REFRESH_MINUTES = 5
const TEMPORAL_RULE_REFRESH_MINUTES = 1
const MINUTES_PER_DAY = 24 * 60

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function createEmptyDailyStats(date = new Date()): DailyStats {
  return {
    date: formatLocalDate(date),
    counts: {},
    durations: {},
    sessionCounts: {},
  }
}

export function getNextLocalMidnight(from = new Date()): number {
  const nextMidnight = new Date(from)
  nextMidnight.setHours(24, 0, 0, 0)
  return nextMidnight.getTime()
}

function getCooldownDurationMinutes(rule: BlockRule): number | null {
  const restriction = rule.restrictions.find((value) => value.type === 'cooldown')
  return restriction?.type === 'cooldown' ? restriction.cooldownMinutes : null
}

export function getCooldownAlarmTime(
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

export function scheduleDailyResetAlarm(now = new Date()): void {
  chrome.alarms.create(DAILY_RESET_ALARM, {
    when: getNextLocalMidnight(now),
    periodInMinutes: MINUTES_PER_DAY,
  })
}

export function scheduleLocationRefreshAlarm(): void {
  chrome.alarms.create(LOCATION_REFRESH_ALARM, {
    periodInMinutes: LOCATION_REFRESH_MINUTES,
  })
}

export function scheduleTemporalRuleRefreshAlarm(): void {
  chrome.alarms.create(TEMPORAL_RULE_REFRESH_ALARM, {
    periodInMinutes: TEMPORAL_RULE_REFRESH_MINUTES,
  })
}

export function restoreCooldownAlarms(
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

export function scheduleCooldownAlarmForRule(
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
