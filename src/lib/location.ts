import { addLocation, getBackgroundState } from './storage'
import type { LocationState } from './types'

export type BrowserCoordinates = {
  latitude: number
  longitude: number
  accuracy: number | null
}

type LocationRefreshResponse = {
  ok: boolean
  locationState?: LocationState
  error?: string
}

function getGeolocationApi(): Geolocation {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not available')
  }

  return navigator.geolocation
}

export async function getCurrentLocationState(): Promise<LocationState> {
  const backgroundState = await getBackgroundState()
  return backgroundState.locationState
}

export async function requestBrowserCoordinates(): Promise<BrowserCoordinates> {
  const geolocation = getGeolocationApi()

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        })
      },
      (error) => {
        reject(new Error(error.message || 'Failed to retrieve location'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  })
}

export async function refreshCurrentLocationState(): Promise<LocationState> {
  const coordinates = await requestBrowserCoordinates()
  const response = (await chrome.runtime.sendMessage({
    type: 'location:refresh',
    coordinates,
  })) as LocationRefreshResponse

  if (!response.ok || !response.locationState) {
    throw new Error(response.error ?? 'Failed to refresh location state')
  }

  return response.locationState
}

export async function saveCurrentLocation(
  name: string,
  radiusMeters: number,
): Promise<void> {
  const coordinates = await requestBrowserCoordinates()
  await addLocation(
    name,
    coordinates.latitude,
    coordinates.longitude,
    radiusMeters,
  )
  await refreshCurrentLocationState()
}
