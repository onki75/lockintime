import type { Location, LocationState } from '../lib/types'

export type Coordinates = {
  latitude: number
  longitude: number
  accuracy?: number | null
}

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

export function getDistanceMeters(
  left: Coordinates,
  right: Coordinates,
): number {
  const latitudeDelta = toRadians(right.latitude - left.latitude)
  const longitudeDelta = toRadians(right.longitude - left.longitude)
  const latitude1 = toRadians(left.latitude)
  const latitude2 = toRadians(right.latitude)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}

export function getActiveLocationIds(
  locations: Location[],
  coordinates: Coordinates,
): string[] {
  return locations
    .filter((location) => {
      const distance = getDistanceMeters(coordinates, {
        latitude: location.latitude,
        longitude: location.longitude,
      })

      return distance <= location.radiusMeters
    })
    .map((location) => location.id)
}

export function projectLocationState(
  locations: Location[],
  coordinates: Coordinates | null,
  options: {
    now?: number
    error?: string | null
  } = {},
): LocationState {
  const now = options.now ?? Date.now()

  return {
    activeLocationIds: coordinates ? getActiveLocationIds(locations, coordinates) : [],
    lastCheckedAt: now,
    lastError: options.error ?? null,
  }
}
