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

export function isSessionActive(state: SessionState, ruleId: string): boolean {
  return state.active[ruleId] !== undefined
}

export function getActiveSessionRuleIds(state: SessionState): string[] {
  return Object.keys(state.active)
}

export function getSession(
  state: SessionState,
  ruleId: string,
): DailyCountSession | null {
  return state.active[ruleId] ?? null
}

export function startSession(
  state: SessionState,
  ruleId: string,
  now: number,
): SessionState {
  const next = cloneSessionState(state)
  next.active[ruleId] = {
    ruleId,
    startedAt: now,
    elapsedMs: 0,
    lastActiveAt: now,
  }
  return next
}

export function tickSession(
  state: SessionState,
  ruleId: string,
  now: number,
): SessionState {
  const session = state.active[ruleId]
  if (!session) {
    return state
  }

  if (session.lastActiveAt === null) {
    return state
  }

  const delta = Math.max(0, now - session.lastActiveAt)
  if (delta === 0) {
    return state
  }

  const next = cloneSessionState(state)
  next.active[ruleId] = {
    ...session,
    elapsedMs: session.elapsedMs + delta,
    lastActiveAt: now,
  }
  return next
}

export function pauseSession(
  state: SessionState,
  ruleId: string,
  now: number,
): SessionState {
  const session = state.active[ruleId]
  if (!session || session.lastActiveAt === null) {
    return state
  }

  const ticked = tickSession(state, ruleId, now)
  const tickedSession = ticked.active[ruleId]
  const next = cloneSessionState(ticked)
  next.active[ruleId] = {
    ...tickedSession,
    lastActiveAt: null,
  }
  return next
}

export function resumeSession(
  state: SessionState,
  ruleId: string,
  now: number,
): SessionState {
  const session = state.active[ruleId]
  if (!session || session.lastActiveAt !== null) {
    return state
  }

  const next = cloneSessionState(state)
  next.active[ruleId] = {
    ...session,
    lastActiveAt: now,
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

export function hasSessionExpired(
  session: DailyCountSession,
  perSessionMinutes: number,
  now: number,
): boolean {
  const projected =
    session.lastActiveAt !== null
      ? session.elapsedMs + Math.max(0, now - session.lastActiveAt)
      : session.elapsedMs
  return projected >= perSessionMinutes * 60_000
}

export function addSessionElapsed(
  state: SessionState,
  ruleId: string,
  elapsedMs: number,
  now: number,
): SessionState {
  const session = state.active[ruleId]
  if (!session) {
    return state
  }

  const delta = Math.max(0, elapsedMs)
  if (delta === 0 && session.lastActiveAt === now) {
    return state
  }

  const next = cloneSessionState(state)
  next.active[ruleId] = {
    ...session,
    elapsedMs: session.elapsedMs + delta,
    lastActiveAt: now,
  }
  return next
}
