import {
  getBackgroundState,
  getSettings,
  saveBypassState,
} from '../lib/storage'
import { resolveEffectiveLicensePlan } from '../lib/license'
import { getActiveRules, resolveRulePlanState } from '../lib/rule-activation'
import { isTrialActive } from '../lib/trial'
import { getDelayGateForHostname, type RuleEvaluationContext } from './rule-engine'
import { createBypassEntry, pruneExpiredBypasses, upsertBypassEntry } from './runtime-state'
import type { Coordinates } from './location-checker'

export type RuntimeMessage =
  | { type: 'delay:should-gate'; hostname: string }
  | { type: 'screen-time:check'; hostname: string }
  | { type: 'screen-time:heartbeat'; hostname: string; sessionMs: number }
  | { type: 'bypass:start'; ruleId: string; durationMinutes: number }
  | { type: 'location:refresh'; coordinates?: Coordinates }
  | { type: 'location:state' }

export type SyncCallback = () => Promise<void>

export function createMessageHandler(deps: {
  syncCurrentRules: SyncCallback
  refreshLocationState: (coordinates?: Coordinates) => Promise<unknown>
  getScreenTimeStatus: (
    hostname: string,
  ) => Promise<{ tracked: boolean; todayMinutes: number; goalMinutes: number | null }>
}) {
  return async function handleRuntimeMessage(
    message: RuntimeMessage,
  ): Promise<unknown> {
    switch (message.type) {
      case 'delay:should-gate': {
        const [settings, backgroundState] = await Promise.all([
          getSettings(),
          getBackgroundState(),
        ])
        const context: RuleEvaluationContext = {
          dailyStats: backgroundState.dailyStats,
          cooldownState: backgroundState.cooldownState,
          bypassState: pruneExpiredBypasses(backgroundState.bypassState),
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
      case 'screen-time:check':
        return deps.getScreenTimeStatus(message.hostname)
      case 'screen-time:heartbeat': {
        const screenTimeStatus = await deps.getScreenTimeStatus(message.hostname)

        return {
          ok: true,
          todayMinutes: screenTimeStatus.todayMinutes,
          goalMinutes: screenTimeStatus.goalMinutes,
        }
      }
      case 'bypass:start': {
        const backgroundState = await getBackgroundState()
        const bypassState = pruneExpiredBypasses(backgroundState.bypassState)
        const entry = createBypassEntry(message.ruleId, message.durationMinutes)
        const nextBypassState = upsertBypassEntry(bypassState, entry)

        await saveBypassState(nextBypassState)
        await deps.syncCurrentRules()

        return {
          ok: true,
          entry,
        }
      }
      case 'location:refresh': {
        const locationState = await deps.refreshLocationState(message.coordinates)
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
