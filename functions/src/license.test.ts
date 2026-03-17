import { describe, expect, it } from 'vitest'
import {
  derivePlanFromPriceIds,
  projectLicenseRecord,
  shouldDeleteCloudData,
} from './license'

describe('projectLicenseRecord', () => {
  it('projects a firestore-friendly license record', () => {
    expect(projectLicenseRecord('cloud', 1000, 'stripe')).toEqual({
      plan: 'cloud',
      lastVerified: 1000,
      updatedAt: 1000,
      updatedBy: 'stripe',
    })
  })
})

describe('derivePlanFromPriceIds', () => {
  it('chooses the highest entitlement from the configured stripe price ids', () => {
    expect(
      derivePlanFromPriceIds(
        {
          price_cloud_monthly: 'cloud',
          price_pro_yearly: 'pro',
        },
        ['price_pro_yearly', 'price_cloud_monthly'],
      ),
    ).toBe('cloud')
  })

  it('falls back to free when no known prices are present', () => {
    expect(derivePlanFromPriceIds({}, ['unknown'])).toBe('free')
  })
})

describe('shouldDeleteCloudData', () => {
  it('deletes retained cloud data after 90 days on a downgraded license', () => {
    const now = Date.UTC(2026, 5, 1)

    expect(
      shouldDeleteCloudData(
        {
          plan: 'pro',
          downgradedFromCloudAt: now - 91 * 24 * 60 * 60 * 1000,
        },
        now,
      ),
    ).toBe(true)
  })

  it('keeps cloud data when the user is still on the cloud plan', () => {
    const now = Date.UTC(2026, 5, 1)

    expect(
      shouldDeleteCloudData(
        {
          plan: 'cloud',
          downgradedFromCloudAt: now - 120 * 24 * 60 * 60 * 1000,
        },
        now,
      ),
    ).toBe(false)
  })
})
