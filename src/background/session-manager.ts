import type { DailyCountSession, SessionState } from '../lib/types'

export function createEmptySessionState(): SessionState {
  return { active: {} }
}

export function cloneSessionState(state: SessionState): SessionState {
  return {
    active: Object.fromEntries(
      Object.entries(state.active).map(([key, value]) => [key, { ...value }]),
    ),
  }
}

export function getSession(
  state: SessionState,
  ruleId: string,
): DailyCountSession | null {
  return state.active[ruleId] ?? null
}

export function getActiveSessionRuleIds(state: SessionState): string[] {
  return Object.keys(state.active)
}

/**
 * A session is valid only while wall-clock time is before its expiresAt.
 * A missing session, or a legacy session without a finite expiresAt, is
 * treated as already invalid so stale state can never suppress a block.
 */
export function isSessionValid(
  state: SessionState,
  ruleId: string,
  now: number,
): boolean {
  const session = state.active[ruleId]
  if (!session) {
    return false
  }
  return Number.isFinite(session.expiresAt) && now < session.expiresAt
}

export function getRemainingMs(
  state: SessionState,
  ruleId: string,
  now: number,
): number {
  const session = state.active[ruleId]
  if (!session || !Number.isFinite(session.expiresAt)) {
    return 0
  }
  return Math.max(0, session.expiresAt - now)
}

export function startSession(
  state: SessionState,
  ruleId: string,
  now: number,
  perSessionMinutes: number,
): SessionState {
  const next = cloneSessionState(state)
  next.active[ruleId] = {
    ruleId,
    startedAt: now,
    expiresAt: now + perSessionMinutes * 60_000,
  }
  return next
}

export function endSession(state: SessionState, ruleId: string): SessionState {
  if (!state.active[ruleId]) {
    return state
  }

  const next = cloneSessionState(state)
  delete next.active[ruleId]
  return next
}

/** Drop every session whose expiresAt has passed (or is invalid). */
export function pruneExpiredSessions(
  state: SessionState,
  now: number,
): SessionState {
  const expiredRuleIds = Object.keys(state.active).filter(
    (ruleId) => !isSessionValid(state, ruleId, now),
  )
  if (expiredRuleIds.length === 0) {
    return state
  }

  const next = cloneSessionState(state)
  for (const ruleId of expiredRuleIds) {
    delete next.active[ruleId]
  }
  return next
}
