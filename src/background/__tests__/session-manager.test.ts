import { describe, expect, it } from 'vitest'
import type { SessionState } from '../../lib/types'
import {
  addSessionElapsed,
  cloneSessionState,
  createEmptySessionState,
  endSession,
  getActiveSessionRuleIds,
  hasSessionExpired,
  isSessionActive,
  pauseSession,
  resumeSession,
  startSession,
  tickSession,
} from '../session-manager'

const RULE = 'rule-1'

function emptyState(): SessionState {
  return { active: {} }
}

describe('startSession', () => {
  it('creates an active session with elapsedMs=0 and lastActiveAt=now', () => {
    const now = 1_700_000_000_000
    const next = startSession(emptyState(), RULE, now)
    expect(next.active[RULE]).toEqual({
      ruleId: RULE,
      startedAt: now,
      elapsedMs: 0,
      lastActiveAt: now,
    })
  })

  it('replaces an existing session for the same rule', () => {
    const initial: SessionState = {
      active: {
        [RULE]: { ruleId: RULE, startedAt: 1, elapsedMs: 60_000, lastActiveAt: null },
      },
    }
    const next = startSession(initial, RULE, 1_700_000_000_000)
    expect(next.active[RULE].elapsedMs).toBe(0)
    expect(next.active[RULE].startedAt).toBe(1_700_000_000_000)
  })
})

describe('tickSession', () => {
  it('accumulates elapsedMs based on the delta since lastActiveAt', () => {
    const start = 1_700_000_000_000
    const state = startSession(emptyState(), RULE, start)
    const next = tickSession(state, RULE, start + 30_000)
    expect(next.active[RULE].elapsedMs).toBe(30_000)
    expect(next.active[RULE].lastActiveAt).toBe(start + 30_000)
  })

  it('does not advance elapsedMs when the session is paused (lastActiveAt=null)', () => {
    const start = 1_700_000_000_000
    const paused = pauseSession(startSession(emptyState(), RULE, start), RULE, start + 10_000)
    const next = tickSession(paused, RULE, start + 60_000)
    expect(next.active[RULE].elapsedMs).toBe(10_000)
    expect(next.active[RULE].lastActiveAt).toBeNull()
  })

  it('returns the state unchanged when no session exists for the rule', () => {
    const state = emptyState()
    const next = tickSession(state, RULE, 1_700_000_000_000)
    expect(next).toBe(state)
  })
})

describe('pauseSession / resumeSession', () => {
  it('pauseSession freezes elapsedMs at the current tick value', () => {
    const start = 1_700_000_000_000
    const ticked = tickSession(startSession(emptyState(), RULE, start), RULE, start + 20_000)
    const paused = pauseSession(ticked, RULE, start + 20_000)
    expect(paused.active[RULE].lastActiveAt).toBeNull()
    expect(paused.active[RULE].elapsedMs).toBe(20_000)
  })

  it('resumeSession sets lastActiveAt without changing elapsedMs', () => {
    const start = 1_700_000_000_000
    const paused = pauseSession(startSession(emptyState(), RULE, start), RULE, start + 10_000)
    const resumed = resumeSession(paused, RULE, start + 60_000)
    expect(resumed.active[RULE].lastActiveAt).toBe(start + 60_000)
    expect(resumed.active[RULE].elapsedMs).toBe(10_000)
  })

  it('resumeSession is a no-op when already active', () => {
    const start = 1_700_000_000_000
    const state = startSession(emptyState(), RULE, start)
    const resumed = resumeSession(state, RULE, start + 1_000)
    expect(resumed).toBe(state)
  })
})

describe('endSession', () => {
  it('removes the rule entry from active sessions', () => {
    const state = startSession(emptyState(), RULE, 1)
    const ended = endSession(state, RULE)
    expect(ended.active[RULE]).toBeUndefined()
  })

  it('is a no-op when no session exists for the rule', () => {
    const state = emptyState()
    expect(endSession(state, RULE)).toBe(state)
  })
})

describe('isSessionActive / getActiveSessionRuleIds', () => {
  it('reports active when a session exists regardless of pause state', () => {
    const state = startSession(emptyState(), RULE, 1)
    expect(isSessionActive(state, RULE)).toBe(true)
    const paused = pauseSession(state, RULE, 2)
    expect(isSessionActive(paused, RULE)).toBe(true)
  })

  it('returns an empty list for an empty state', () => {
    expect(getActiveSessionRuleIds(emptyState())).toEqual([])
  })
})

describe('addSessionElapsed / hasSessionExpired', () => {
  it('adds elapsedMs from heartbeats and updates lastActiveAt', () => {
    const state = startSession(emptyState(), RULE, 0)
    const next = addSessionElapsed(state, RULE, 5_000, 5_000)
    expect(next.active[RULE].elapsedMs).toBe(5_000)
    expect(next.active[RULE].lastActiveAt).toBe(5_000)
  })

  it('treats negative or zero deltas as no-ops on elapsedMs but still refreshes lastActiveAt', () => {
    const state = startSession(emptyState(), RULE, 0)
    const next = addSessionElapsed(state, RULE, -10, 1_000)
    expect(next.active[RULE].elapsedMs).toBe(0)
    expect(next.active[RULE].lastActiveAt).toBe(1_000)
  })

  it('reports expired once elapsedMs reaches perSessionMinutes', () => {
    const state = addSessionElapsed(
      startSession(emptyState(), RULE, 0),
      RULE,
      10 * 60_000,
      10 * 60_000,
    )
    const session = state.active[RULE]
    expect(hasSessionExpired(session, 10, 10 * 60_000)).toBe(true)
  })

  it('hasSessionExpired projects wall-clock when active', () => {
    const state = startSession(emptyState(), RULE, 0)
    const session = state.active[RULE]
    expect(hasSessionExpired(session, 1, 60_000)).toBe(true)
    expect(hasSessionExpired(session, 1, 59_000)).toBe(false)
  })

  it('hasSessionExpired treats an invalid perSessionMinutes as expired', () => {
    const state = startSession(emptyState(), RULE, 1_000)
    const session = state.active[RULE]
    expect(hasSessionExpired(session, Number.NaN, 1_000)).toBe(true)
    expect(hasSessionExpired(session, undefined as unknown as number, 1_000)).toBe(true)
    expect(hasSessionExpired(session, 0, 1_000)).toBe(true)
    expect(hasSessionExpired(session, -5, 1_000)).toBe(true)
  })
})

describe('cloneSessionState / createEmptySessionState', () => {
  it('deep-clones the state', () => {
    const state = startSession(emptyState(), RULE, 1)
    const cloned = cloneSessionState(state)
    expect(cloned).toEqual(state)
    expect(cloned.active).not.toBe(state.active)
  })

  it('createEmptySessionState returns an empty active map', () => {
    expect(createEmptySessionState()).toEqual({ active: {} })
  })
})
