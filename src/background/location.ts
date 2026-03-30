import type { LocationState } from '../lib/types'
import { getSettings, saveLocationState } from '../lib/storage'
import { projectLocationState, type Coordinates } from './location-checker'

const LOCATION_OFFSCREEN_PATH = 'offscreen.html'

type OffscreenContext = {
  documentUrl?: string
}

type RuntimeWithContexts = typeof chrome.runtime & {
  getContexts?: (filter: {
    contextTypes?: string[]
    documentUrls?: string[]
  }) => Promise<OffscreenContext[]>
}

async function ensureLocationOffscreenDocument(): Promise<boolean> {
  if (!('offscreen' in chrome) || !chrome.offscreen?.createDocument) {
    return false
  }

  const runtime = chrome.runtime as RuntimeWithContexts
  const documentUrl = chrome.runtime.getURL(LOCATION_OFFSCREEN_PATH)

  if (runtime.getContexts) {
    const contexts = await runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [documentUrl],
    })

    if (contexts.length > 0) {
      return true
    }
  }

  await chrome.offscreen.createDocument({
    url: LOCATION_OFFSCREEN_PATH,
    reasons: ['GEOLOCATION'],
    justification: 'Refresh location-based blocking rules in the background',
  })
  return true
}

export async function requestCoordinatesFromOffscreen(): Promise<Coordinates> {
  const ready = await ensureLocationOffscreenDocument()
  if (!ready) {
    throw new Error('Offscreen geolocation is unavailable')
  }

  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'location-offscreen' })
    const timeout = globalThis.setTimeout(() => {
      port.disconnect()
      reject(new Error('Location request timed out'))
    }, 12_000)

    port.onMessage.addListener((message: { ok?: boolean; coordinates?: Coordinates; error?: string }) => {
      clearTimeout(timeout)
      port.disconnect()

      if (message.ok && message.coordinates) {
        resolve(message.coordinates)
        return
      }

      reject(new Error(message.error ?? 'Failed to resolve current location'))
    })

    port.postMessage({ type: 'location:get-current' })
  })
}

export type SyncCallback = () => Promise<void>

export async function refreshLocationState(
  coordinates?: Coordinates,
  syncCurrentRules?: SyncCallback,
): Promise<LocationState> {
  const settings = await getSettings()
  const now = Date.now()

  try {
    const resolvedCoordinates = coordinates ?? await requestCoordinatesFromOffscreen()
    const locationState = projectLocationState(settings.locations, resolvedCoordinates, { now })

    await saveLocationState(locationState)
    if (syncCurrentRules) await syncCurrentRules()

    return locationState
  } catch (error) {
    const locationState = projectLocationState(settings.locations, null, {
      now,
      error: (error as Error).message,
    })

    await saveLocationState(locationState)
    if (syncCurrentRules) await syncCurrentRules()
    return locationState
  }
}
