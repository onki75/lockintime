import { describe, expect, it } from 'vitest'
import type { SessionState } from '../../lib/types'
import {
  cloneSessionState,
  createEmptySessionState,
  endSession,
  getActiveSessionRuleIds,
  getRemainingMs,
  getSession,
  isSessionValid,
  pruneExpiredSessions,
  startSession,
} from '../session-manager'

const RULE = 'rule-1'
const NOW = 1_700_000_000_000

function emptyState(): SessionState {
  return { active: {} }
}

describe('startSession', () => {
  it('creates a session expiring perSessionMinutes after now', () => {
    const next = startSession(emptyState(), RULE, NOW, 10)
    expect(next.active[RULE]).toEqual({
      ruleId: RULE,
      startedAt: NOW,
      expiresAt: NOW + 10 * 60_000,
    })
  })

  it('replaces an existing session for the same rule', () => {
    const initial = startSession(emptyState(), RULE, NOW, 5)
    const next = startSession(initial, RULE, NOW + 1_000, 10)
    expect(next.active[RULE].startedAt).toBe(NOW + 1_000)
    expect(next.active[RULE].expiresAt).toBe(NOW + 1_000 + 10 * 60_000)
  })
})

describe('isSessionValid', () => {
  it('is true before expiresAt and false at/after it', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(isSessionValid(state, RULE, NOW)).toBe(true)
    expect(isSessionValid(state, RULE, NOW + 10 * 60_000 - 1)).toBe(true)
    expect(isSessionValid(state, RULE, NOW + 10 * 60_000)).toBe(false)
    expect(isSessionValid(state, RULE, NOW + 60 * 60_000)).toBe(false)
  })

  it('is false when no session exists', () => {
    expect(isSessionValid(emptyState(), RULE, NOW)).toBe(false)
  })

  it('treats a legacy session without a finite expiresAt as invalid', () => {
    const state: SessionState = {
      active: {
        [RULE]: { ruleId: RULE, startedAt: NOW } as never,
      },
    }
    expect(isSessionValid(state, RULE, NOW)).toBe(false)
  })
})

describe('getRemainingMs', () => {
  it('returns the time left until expiresAt', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(getRemainingMs(state, RULE, NOW)).toBe(10 * 60_000)
    expect(getRemainingMs(state, RULE, NOW + 4 * 60_000)).toBe(6 * 60_000)
  })

  it('clamps to zero once expired or missing', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(getRemainingMs(state, RULE, NOW + 99 * 60_000)).toBe(0)
    expect(getRemainingMs(emptyState(), RULE, NOW)).toBe(0)
  })
})

describe('endSession', () => {
  it('removes the rule entry', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(endSession(state, RULE).active[RULE]).toBeUndefined()
  })

  it('is a no-op when no session exists', () => {
    const state = emptyState()
    expect(endSession(state, RULE)).toBe(state)
  })
})

describe('pruneExpiredSessions', () => {
  it('drops expired sessions and keeps valid ones', () => {
    let state = startSession(emptyState(), 'valid', NOW, 10)
    state = startSession(state, 'expired', NOW - 60 * 60_000, 10)
    const pruned = pruneExpiredSessions(state, NOW)
    expect(getActiveSessionRuleIds(pruned)).toEqual(['valid'])
  })

  it('returns the same reference when nothing is expired', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(pruneExpiredSessions(state, NOW)).toBe(state)
  })
})

describe('cloneSessionState / createEmptySessionState / getSession', () => {
  it('deep-clones the state', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    const cloned = cloneSessionState(state)
    expect(cloned).toEqual(state)
    expect(cloned.active).not.toBe(state.active)
  })

  it('createEmptySessionState returns an empty active map', () => {
    expect(createEmptySessionState()).toEqual({ active: {} })
  })

  it('getSession returns the entry or null', () => {
    const state = startSession(emptyState(), RULE, NOW, 10)
    expect(getSession(state, RULE)?.ruleId).toBe(RULE)
    expect(getSession(state, 'other')).toBeNull()
  })
})
