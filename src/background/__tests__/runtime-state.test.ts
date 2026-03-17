import { describe, expect, it } from 'vitest'
import {
  getActiveBypassEntry,
  pruneExpiredBypasses,
  setLocationCheckResult,
  upsertBypassEntry,
} from '../runtime-state'

describe('pruneExpiredBypasses', () => {
  it('removes expired entries', () => {
    expect(
      pruneExpiredBypasses(
        {
          entries: [
            { ruleId: 'rule-1', expiresAt: 100, createdAt: 0 },
            { ruleId: 'rule-2', expiresAt: 300, createdAt: 0 },
          ],
        },
        200,
      ),
    ).toEqual({
      entries: [{ ruleId: 'rule-2', expiresAt: 300, createdAt: 0 }],
    })
  })
})

describe('upsertBypassEntry', () => {
  it('replaces an existing rule entry and keeps expiration order', () => {
    expect(
      upsertBypassEntry(
        {
          entries: [
            { ruleId: 'rule-1', expiresAt: 200, createdAt: 0 },
            { ruleId: 'rule-2', expiresAt: 500, createdAt: 0 },
          ],
        },
        { ruleId: 'rule-1', expiresAt: 100, createdAt: 10 },
      ),
    ).toEqual({
      entries: [
        { ruleId: 'rule-1', expiresAt: 100, createdAt: 10 },
        { ruleId: 'rule-2', expiresAt: 500, createdAt: 0 },
      ],
    })
  })
})

describe('getActiveBypassEntry', () => {
  it('returns the matching entry when still active', () => {
    expect(
      getActiveBypassEntry(
        {
          entries: [{ ruleId: 'rule-1', expiresAt: 200, createdAt: 10 }],
        },
        'rule-1',
        150,
      ),
    ).toEqual({ ruleId: 'rule-1', expiresAt: 200, createdAt: 10 })
  })
})

describe('setLocationCheckResult', () => {
  it('normalizes the location state payload', () => {
    expect(setLocationCheckResult(['b', 'a'], 1000)).toEqual({
      activeLocationIds: ['a', 'b'],
      lastCheckedAt: 1000,
      lastError: null,
    })
  })
})
