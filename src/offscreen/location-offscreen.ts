type Coordinates = {
  latitude: number
  longitude: number
  accuracy?: number | null
}

function getCurrentPosition(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not available')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        })
      },
      (error) => reject(new Error(error.message || 'Failed to retrieve location')),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  })
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'location-offscreen') {
    return
  }

  port.onMessage.addListener((message: { type?: string }) => {
    if (message.type !== 'location:get-current') {
      return
    }

    void getCurrentPosition()
      .then((coordinates) => {
        port.postMessage({
          ok: true,
          coordinates,
        })
      })
      .catch((error) => {
        port.postMessage({
          ok: false,
          error: (error as Error).message,
        })
      })
  })
})
