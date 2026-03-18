import { describe, expect, it } from 'vitest'
import { buildCleanupPlan, toUserDocumentPaths } from './cleanup'

describe('buildCleanupPlan', () => {
  it('returns cleanup targets after the retention period elapses', () => {
    const now = Date.UTC(2026, 5, 1)

    expect(
      buildCleanupPlan(
        {
          plan: 'pro',
          downgradedFromCloudAt: now - 91 * 24 * 60 * 60 * 1000,
        },
        now,
      ),
    ).toEqual({
      shouldDelete: true,
      paths: [
        'dailyStats',
        'streak/data',
        'runtime/cooldown',
        'meta/sync',
        'tombstones/current',
      ],
    })
  })

  it('keeps cloud data when the user is still within retention', () => {
    const now = Date.UTC(2026, 5, 1)

    expect(
      buildCleanupPlan(
        {
          plan: 'pro',
          downgradedFromCloudAt: now - 14 * 24 * 60 * 60 * 1000,
        },
        now,
      ),
    ).toEqual({
      shouldDelete: false,
      paths: [],
    })
  })
})

describe('toUserDocumentPaths', () => {
  it('prefixes cleanup paths with the user document root', () => {
    expect(
      toUserDocumentPaths('user-1', {
        shouldDelete: true,
        paths: ['dailyStats', 'meta/sync'],
      }),
    ).toEqual([
      'users/user-1/dailyStats',
      'users/user-1/meta/sync',
    ])
  })
})
