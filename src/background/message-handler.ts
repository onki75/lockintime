import {
  getBackgroundState,
  getSettings,
  saveBypassState,
  saveSessionState,
  updateDailyStats,
} from '../lib/storage'
import { resolveEffectiveLicensePlan } from '../lib/license'
import { getActiveRules, resolveRulePlanState } from '../lib/rule-activation'
import { isTrialActive } from '../lib/trial'
import { getDelayGateForHostname, type RuleEvaluationContext } from './rule-engine'
import { createBypassEntry, pruneExpiredBypasses, upsertBypassEntry } from './runtime-state'
import {
  cloneSessionState,
  isSessionActive,
  startSession,
} from './session-manager'
import { createDailyStatsForDate } from './access-counter'
import type { Coordinates } from './location-checker'

export type RuntimeMessage =
  | { type: 'delay:should-gate'; hostname: string }
  | { type: 'screen-time:check'; hostname: string }
  | { type: 'screen-time:heartbeat'; hostname: string; elapsedMs: number }
  | { type: 'bypass:start'; ruleId: string; durationMinutes: number }
  | { type: 'daily-count-session:start'; ruleId: string }
  | { type: 'daily-count-session:status'; ruleId: string }
  | { type: 'location:refresh'; coordinates?: Coordinates }
  | { type: 'location:state' }

export type SyncCallback = () => Promise<void>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasHostname(message: Record<string, unknown>): message is Record<string, unknown> & { hostname: string } {
  return typeof message.hostname === 'string' && message.hostname.length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isValidCoordinates(value: unknown): value is Coordinates {
  return (
    isRecord(value) &&
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  )
}

export function createMessageHandler(deps: {
  syncCurrentRules: SyncCallback
  refreshLocationState: (coordinates?: Coordinates) => Promise<unknown>
  getScreenTimeStatus: (
    hostname: string,
  ) => Promise<{
    tracked: boolean
    todayMinutes: number
    goalMinutes: number | null
    activeSession: { ruleId: string; remainingMs: number; perSessionMinutes: number } | null
  }>
  recordScreenTimeHeartbeat: (
    hostname: string,
    elapsedMs: number,
  ) => Promise<{
    tracked: boolean
    todayMinutes: number
    goalMinutes: number | null
    activeSession: { ruleId: string; remainingMs: number; perSessionMinutes: number } | null
  }>
  recordBypassStreak: SyncCallback
}) {
  return async function handleRuntimeMessage(
    message: RuntimeMessage | unknown,
  ): Promise<unknown> {
    if (!isRecord(message) || typeof message.type !== 'string') {
      return { ok: false, error: 'Invalid message' }
    }

    switch (message.type) {
      case 'delay:should-gate': {
        if (!hasHostname(message)) {
          return { ok: false, error: 'Missing hostname' }
        }

        const [settings, backgroundState] = await Promise.all([
          getSettings(),
          getBackgroundState(),
        ])
        const context: RuleEvaluationContext = {
          dailyStats: backgroundState.dailyStats,
          cooldownState: backgroundState.cooldownState,
          bypassState: pruneExpiredBypasses(backgroundState.bypassState),
          sessionState: backgroundState.sessionState,
          activeLocationIds: backgroundState.locationState.activeLocationIds,
        }
        const rulePlan = resolveRulePlanState({
          trialActive: await isTrialActive(),
          licensePlan: resolveEffectiveLicensePlan(backgroundState.licenseCache),
        })
        const decision = getDelayGateForHostname(
          message.hostname,
          getActiveRules(settings.blockRules, {
            plan: rulePlan,
            freeActiveRuleIds: settings.freeActiveRuleIds,
          }),
          context,
        )

        return {
          ok: true,
          gate: decision,
        }
      }
      case 'screen-time:check': {
        if (!hasHostname(message)) {
          return { ok: false, error: 'Missing hostname' }
        }

        return deps.getScreenTimeStatus(message.hostname)
      }
      case 'screen-time:heartbeat': {
        if (!hasHostname(message)) {
          return { ok: false, error: 'Missing hostname' }
        }

        if (!isPositiveFiniteNumber(message.elapsedMs)) {
          return { ok: false, error: 'Invalid screen time heartbeat' }
        }

        const screenTimeStatus = await deps.recordScreenTimeHeartbeat(
          message.hostname,
          message.elapsedMs,
        )

        return {
          ok: true,
          todayMinutes: screenTimeStatus.todayMinutes,
          goalMinutes: screenTimeStatus.goalMinutes,
          activeSession: screenTimeStatus.activeSession,
        }
      }
      case 'daily-count-session:start': {
        if (typeof message.ruleId !== 'string' || !message.ruleId) {
          return { ok: false, error: 'Invalid session request' }
        }

        const [settings, backgroundState] = await Promise.all([
          getSettings(),
          getBackgroundState(),
        ])
        const rule = settings.blockRules.find((r) => r.id === message.ruleId)
        if (!rule) {
          return { ok: false, error: 'Rule not found' }
        }

        const dailyCount = rule.restrictions.find(
          (restriction): restriction is Extract<typeof restriction, { type: 'daily_count' }> =>
            restriction.type === 'daily_count',
        )
        if (!dailyCount) {
          return { ok: false, error: 'Rule does not have daily_count' }
        }

        if (isSessionActive(backgroundState.sessionState, rule.id)) {
          return {
            ok: true,
            session: backgroundState.sessionState.active[rule.id],
            perSessionMinutes: dailyCount.perSessionMinutes,
          }
        }

        const usedCount = backgroundState.dailyStats?.sessionCounts?.[rule.id] ?? 0
        if (usedCount >= dailyCount.maxCount) {
          return { ok: false, error: 'Daily limit exhausted' }
        }

        const now = Date.now()
        await updateDailyStats((currentDailyStats) => {
          const base = currentDailyStats ?? createDailyStatsForDate(new Date(now))
          const sessionCounts = { ...(base.sessionCounts ?? {}) }
          sessionCounts[rule.id] = (sessionCounts[rule.id] ?? 0) + 1
          return {
            ...base,
            counts: { ...base.counts },
            durations: { ...base.durations },
            sessionCounts,
          }
        })

        const nextSessionState = startSession(
          cloneSessionState(backgroundState.sessionState),
          rule.id,
          now,
        )
        await saveSessionState(nextSessionState)
        await deps.syncCurrentRules()

        return {
          ok: true,
          session: nextSessionState.active[rule.id],
          perSessionMinutes: dailyCount.perSessionMinutes,
        }
      }
      case 'daily-count-session:status': {
        if (typeof message.ruleId !== 'string' || !message.ruleId) {
          return { ok: false, error: 'Invalid session status request' }
        }

        const [settings, backgroundState] = await Promise.all([
          getSettings(),
          getBackgroundState(),
        ])
        const rule = settings.blockRules.find((r) => r.id === message.ruleId)
        if (!rule) {
          return { ok: false, error: 'Rule not found' }
        }

        const dailyCount = rule.restrictions.find(
          (restriction): restriction is Extract<typeof restriction, { type: 'daily_count' }> =>
            restriction.type === 'daily_count',
        )

        if (!dailyCount) {
          return { ok: false, error: 'Rule does not have daily_count' }
        }

        const totalCount = backgroundState.dailyStats?.sessionCounts?.[rule.id] ?? 0

        return {
          ok: true,
          maxCount: dailyCount.maxCount,
          usedCount: totalCount,
          remainingCount: Math.max(0, dailyCount.maxCount - totalCount),
          perSessionMinutes: dailyCount.perSessionMinutes,
          session: backgroundState.sessionState.active[rule.id] ?? null,
        }
      }
      case 'bypass:start': {
        if (typeof message.ruleId !== 'string' || !isPositiveFiniteNumber(message.durationMinutes)) {
          return { ok: false, error: 'Invalid bypass request' }
        }

        const backgroundState = await getBackgroundState()
        const bypassState = pruneExpiredBypasses(backgroundState.bypassState)
        const entry = createBypassEntry(message.ruleId, message.durationMinutes)
        const nextBypassState = upsertBypassEntry(bypassState, entry)

        await saveBypassState(nextBypassState)
        await deps.recordBypassStreak()
        await deps.syncCurrentRules()

        return {
          ok: true,
          entry,
        }
      }
      case 'location:refresh': {
        if (
          message.coordinates !== undefined &&
          !isValidCoordinates(message.coordinates)
        ) {
          return { ok: false, error: 'Invalid location coordinates' }
        }

        const coordinates = isValidCoordinates(message.coordinates)
          ? message.coordinates
          : undefined
        const locationState = await deps.refreshLocationState(coordinates)
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
}
