import { describe, expect, it } from 'vitest'
import { getActiveLocationIds, getDistanceMeters, projectLocationState } from '../location-checker'

describe('location-checker', () => {
  it('computes distances in meters', () => {
    const distance = getDistanceMeters(
      { latitude: 35.681236, longitude: 139.767125 },
      { latitude: 35.681236, longitude: 139.768125 },
    )

    expect(distance).toBeGreaterThan(80)
    expect(distance).toBeLessThan(120)
  })

  it('returns active location ids when inside a geofence', () => {
    const activeLocationIds = getActiveLocationIds(
      [
        {
          id: 'office',
          name: 'Office',
          latitude: 35.681236,
          longitude: 139.767125,
          radiusMeters: 150,
          updatedAt: 0,
        },
      ],
      {
        latitude: 35.681236,
        longitude: 139.767325,
      },
    )

    expect(activeLocationIds).toEqual(['office'])
  })

  it('projects location state with timestamps', () => {
    const state = projectLocationState([], null, { now: 1234, error: 'denied' })

    expect(state).toEqual({
      activeLocationIds: [],
      lastCheckedAt: 1234,
      lastError: 'denied',
    })
  })
})
