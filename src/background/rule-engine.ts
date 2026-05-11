import type {
  BlockRule,
  BypassState,
  CooldownState,
  DailyStats,
  RestrictionType,
} from '../lib/types'
import { getBlockedDomains } from '../lib/storage'
import { getActiveScheduleEndTime, isWithinSchedule } from './time-scheduler'

export type RuleEvaluationContext = {
  now?: Date
  dailyStats?: DailyStats | null
  cooldownState?: CooldownState
  bypassState?: BypassState
  activeLocationIds?: string[]
}

export type HardBlockReason =
  | 'full_block'
  | 'time_of_day'
  | 'daily_count'
  | 'daily_duration'
  | 'cooldown'
  | 'location'

export type RuleEvaluationResult = {
  ruleId: string
  blocked: boolean
  bypassed: boolean
  reason: HardBlockReason | null
  delaySeconds: number | null
  until: number | null
  matchedDomains: string[]
}

export type DelayGateDecision = {
  ruleId: string
  delaySeconds: number
  matchedDomain: string
}

function nowFromContext(context: RuleEvaluationContext): Date {
  return context.now ?? new Date()
}

function sumDomainMetrics(
  values: Record<string, number>,
  domains: string[],
): number {
  return domains.reduce((total, domain) => total + (values[domain] ?? 0), 0)
}

export function isBypassActive(
  ruleId: string,
  bypassState: BypassState | undefined,
  now = Date.now(),
): boolean {
  return (
    bypassState?.entries.some((entry) => entry.ruleId === ruleId && entry.expiresAt > now) ??
    false
  )
}

export function matchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  const normalizedDomain = domain.toLowerCase()

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

function evaluateHardBlockReason(
  rule: BlockRule,
  context: RuleEvaluationContext,
): { reason: HardBlockReason; until: number | null } | null {
  const now = nowFromContext(context)
  const nowMs = now.getTime()
  const matchedDomains = getBlockedDomains(rule)
  const dailyStats = context.dailyStats

  for (const restriction of rule.restrictions) {
    switch (restriction.type) {
      case 'full_block':
        return { reason: 'full_block', until: null }
      case 'time_of_day': {
        if (!isWithinSchedule(restriction.schedule, now)) {
          break
        }

        return {
          reason: 'time_of_day',
          until: getActiveScheduleEndTime(restriction.schedule, now),
        }
      }
      case 'daily_count': {
        const count = dailyStats
          ? sumDomainMetrics(dailyStats.counts, matchedDomains)
          : 0
        if (count >= restriction.maxCount) {
          return { reason: 'daily_count', until: null }
        }
        break
      }
      case 'daily_duration': {
        const duration = dailyStats
          ? sumDomainMetrics(dailyStats.durations, matchedDomains)
          : 0
        if (duration >= restriction.maxMinutes) {
          return { reason: 'daily_duration', until: null }
        }
        break
      }
      case 'cooldown': {
        const lastAccess = context.cooldownState?.lastAccess[rule.id]
        if (lastAccess == null) {
          break
        }

        const until = lastAccess + restriction.cooldownMinutes * 60 * 1000
        if (until > nowMs) {
          return { reason: 'cooldown', until }
        }
        break
      }
      case 'location': {
        const activeLocationIds = new Set(context.activeLocationIds ?? [])
        const hasBlockedLocation = restriction.locationIds.some((id) =>
          activeLocationIds.has(id),
        )
        if (hasBlockedLocation) {
          return { reason: 'location', until: null }
        }
        break
      }
      case 'delay':
        break
      default:
        restriction satisfies never
    }
  }

  return null
}

function evaluateDelaySeconds(rule: BlockRule): number | null {
  let delaySeconds: number | null = null

  for (const restriction of rule.restrictions) {
    if (restriction.type !== 'delay') {
      continue
    }

    delaySeconds = Math.max(delaySeconds ?? 0, restriction.delaySeconds)
  }

  return delaySeconds
}

export function evaluateRule(
  rule: BlockRule,
  context: RuleEvaluationContext = {},
): RuleEvaluationResult {
  const nowMs = nowFromContext(context).getTime()
  const matchedDomains = getBlockedDomains(rule)
  const bypassed = isBypassActive(rule.id, context.bypassState, nowMs)
  const delaySeconds = bypassed ? null : evaluateDelaySeconds(rule)

  if (bypassed) {
    return {
      ruleId: rule.id,
      blocked: false,
      bypassed,
      reason: null,
      delaySeconds,
      until: null,
      matchedDomains,
    }
  }

  const hardBlock = evaluateHardBlockReason(rule, context)

  return {
    ruleId: rule.id,
    blocked: hardBlock !== null,
    bypassed,
    reason: hardBlock?.reason ?? null,
    delaySeconds,
    until: hardBlock?.until ?? null,
    matchedDomains,
  }
}

export function hasHardBlockReason(reason: RestrictionType | null): reason is HardBlockReason {
  return (
    reason === 'full_block' ||
    reason === 'time_of_day' ||
    reason === 'daily_count' ||
    reason === 'daily_duration' ||
    reason === 'cooldown' ||
    reason === 'location'
  )
}

export function getDelayGateForHostname(
  hostname: string,
  rules: BlockRule[],
  context: RuleEvaluationContext = {},
): DelayGateDecision | null {
  let selected: DelayGateDecision | null = null

  for (const rule of rules) {
    const matchedDomain = getBlockedDomains(rule).find((domain) => matchesDomain(hostname, domain))
    if (!matchedDomain) {
      continue
    }

    const evaluation = evaluateRule(rule, context)
    if (evaluation.blocked || evaluation.delaySeconds === null) {
      continue
    }

    if (!selected || evaluation.delaySeconds > selected.delaySeconds) {
      selected = {
        ruleId: rule.id,
        delaySeconds: evaluation.delaySeconds,
        matchedDomain,
      }
    }
  }

  return selected
}
