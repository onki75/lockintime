import { getBlockedDomains } from '../lib/storage'
import type { BlockRule, CooldownState, DailyStats } from '../lib/types'
import { matchesDomain } from './rule-engine'
import { formatLocalDate, createEmptyDailyStats } from './alarms'

export type NavigationTrackingResult = {
  dailyStats: DailyStats
  cooldownState: CooldownState
  matchedDomains: string[]
  matchedRuleIds: string[]
}

export function createDailyStatsForDate(now = new Date()): DailyStats {
  return createEmptyDailyStats(now)
}

export function getHostnameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function ensureCurrentDailyStats(
  dailyStats: DailyStats | null,
  now: Date,
): DailyStats {
  const expectedDate = formatLocalDate(now)
  if (!dailyStats || dailyStats.date !== expectedDate) {
    return createDailyStatsForDate(now)
  }

  return structuredClone(dailyStats)
}

export function getMatchedDomainsForHostname(
  hostname: string,
  rules: BlockRule[],
): { domains: string[]; ruleIds: string[] } {
  const matchedDomains = new Set<string>()
  const matchedRuleIds = new Set<string>()

  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }

    const domains = getBlockedDomains(rule).filter((domain) => matchesDomain(hostname, domain))
    if (domains.length === 0) {
      continue
    }

    matchedRuleIds.add(rule.id)
    for (const domain of domains) {
      matchedDomains.add(domain)
    }
  }

  return {
    domains: [...matchedDomains],
    ruleIds: [...matchedRuleIds],
  }
}

function hasCooldownRestriction(rule: BlockRule): boolean {
  return rule.restrictions.some((restriction) => restriction.type === 'cooldown')
}

export function recordNavigationAccess(
  url: string,
  rules: BlockRule[],
  currentDailyStats: DailyStats | null,
  currentCooldownState: CooldownState,
  now = new Date(),
): NavigationTrackingResult | null {
  const hostname = getHostnameFromUrl(url)
  if (!hostname) {
    return null
  }

  const { domains, ruleIds } = getMatchedDomainsForHostname(hostname, rules)
  if (domains.length === 0) {
    return null
  }

  const dailyStats = ensureCurrentDailyStats(currentDailyStats, now)
  const cooldownState: CooldownState = structuredClone(currentCooldownState)

  for (const domain of domains) {
    dailyStats.counts[domain] = (dailyStats.counts[domain] ?? 0) + 1
  }

  for (const rule of rules) {
    if (!ruleIds.includes(rule.id) || !hasCooldownRestriction(rule)) {
      continue
    }

    cooldownState.lastAccess[rule.id] = now.getTime()
  }

  return {
    dailyStats,
    cooldownState,
    matchedDomains: domains,
    matchedRuleIds: ruleIds,
  }
}

export function recordDurationForHostname(
  hostname: string,
  rules: BlockRule[],
  currentDailyStats: DailyStats | null,
  durationMs: number,
  now = new Date(),
): DailyStats | null {
  if (durationMs <= 0) {
    return null
  }

  const { domains } = getMatchedDomainsForHostname(hostname, rules)
  if (domains.length === 0) {
    return null
  }

  const dailyStats = ensureCurrentDailyStats(currentDailyStats, now)
  const durationMinutes = durationMs / 60_000

  for (const domain of domains) {
    dailyStats.durations[domain] = (dailyStats.durations[domain] ?? 0) + durationMinutes
  }

  return dailyStats
}
