import type { AuthState } from '../lib/types'
import {
  getBackgroundState,
  getSettings,
  getSyncState,
  saveAuthState,
  saveBypassState,
} from '../lib/storage'
import { signInWithGoogle, signOutFromGoogle } from '../lib/auth'
import { getDelayGateForHostname, type RuleEvaluationContext } from './rule-engine'
import { createBypassEntry, pruneExpiredBypasses, upsertBypassEntry } from './runtime-state'
import {
  reconcileCloudSync,
  handleObservedAuthState,
  forceSyncIfActive,
} from './cloud-sync'
import type { Coordinates } from './location-checker'

export type RuntimeMessage =
  | { type: 'auth:sign-in' }
  | { type: 'auth:sign-out' }
  | { type: 'sync:force' }
  | { type: 'sync:status' }
  | { type: 'delay:should-gate'; hostname: string }
  | { type: 'bypass:start'; ruleId: string; durationMinutes: number }
  | { type: 'location:refresh'; coordinates?: Coordinates }
  | { type: 'location:state' }

export type SyncCallback = () => Promise<void>

export function createMessageHandler(deps: {
  syncCurrentRules: SyncCallback
  refreshLocationState: (coordinates?: Coordinates) => Promise<unknown>
}) {
  return async function handleRuntimeMessage(
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
      case 'sync:force':
        return forceSyncIfActive()
      case 'sync:status':
        return getSyncState()
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
        const decision = getDelayGateForHostname(
          message.hostname,
          settings.blockRules,
          context,
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
