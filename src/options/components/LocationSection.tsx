import { MapPin, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { AddLocationDialog } from '../../components/dialogs/AddLocationDialog'
import { ManualLocationDialog } from '../../components/dialogs/ManualLocationDialog'
import { addLocation, removeLocation } from '../../lib/storage'
import {
  refreshCurrentLocationState,
  requestBrowserCoordinates,
  saveCurrentLocation,
} from '../../lib/location'
import type { Location, LocationState } from '../../lib/types'

type LocationSectionProps = {
  locations: Location[]
  locationState: LocationState | null
}

type DialogCoordinates = {
  latitude: number
  longitude: number
}

export function LocationSection({
  locations,
  locationState,
}: LocationSectionProps) {
  const [dialogCoordinates, setDialogCoordinates] = useState<DialogCoordinates | null>(null)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'refresh' | 'current' | 'manual' | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const activeLocations = useMemo(() => {
    const activeIds = new Set(locationState?.activeLocationIds ?? [])
    return locations.filter((location) => activeIds.has(location.id))
  }, [locationState?.activeLocationIds, locations])

  async function handleRefresh() {
    setPending('refresh')
    setError(null)
    try {
      await refreshCurrentLocationState()
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPending(null)
    }
  }

  async function handleAddCurrent() {
    setPending('current')
    setError(null)
    try {
      const coordinates = await requestBrowserCoordinates()
      setDialogCoordinates({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPending(null)
    }
  }

  async function handleSaveCurrentLocation(name: string, radius: number) {
    setError(null)
    try {
      await saveCurrentLocation(name, radius)
      setDialogCoordinates(null)
    } catch (nextError) {
      setError((nextError as Error).message)
      throw nextError
    }
  }

  async function handleSaveManualLocation(
    name: string,
    latitude: number,
    longitude: number,
    radius: number,
  ) {
    setPending('manual')
    setError(null)
    try {
      await addLocation(name, latitude, longitude, radius)
      setShowManualDialog(false)
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPending(null)
    }
  }

  async function handleDeleteLocation(locationId: string) {
    if (pendingDeleteId === locationId) {
      return
    }

    setError(null)
    setPendingDeleteId(locationId)
    try {
      await removeLocation(locationId)
    } catch (nextError) {
      setError((nextError as Error).message)
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
            Location
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">位置情報制限</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            保存した場所に入ったときだけブロックするルールに使います。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={pending === 'refresh'}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> 現在地を更新
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleAddCurrent()}
            disabled={pending === 'current'}
          >
            <MapPin className="mr-1.5 h-3.5 w-3.5" /> 現在地を保存
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowManualDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 手動追加
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeLocations.length > 0 ? (
          activeLocations.map((location) => (
            <span
              key={location.id}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
            >
              現在地: {location.name}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            現在有効な場所はありません
          </span>
        )}

        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          保存済み {locations.length} 件
        </span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {locations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
            まだ場所が登録されていません。
          </div>
        ) : (
          locations.map((location) => {
            const isActive = activeLocations.some((entry) => entry.id === location.id)

            return (
              <div
                key={location.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{location.name}</p>
                    {isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} / 半径{' '}
                    {location.radiusMeters}m
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleDeleteLocation(location.id)}
                  disabled={pendingDeleteId === location.id}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <AddLocationDialog
        open={dialogCoordinates !== null}
        onClose={() => setDialogCoordinates(null)}
        latitude={dialogCoordinates?.latitude ?? 0}
        longitude={dialogCoordinates?.longitude ?? 0}
        onSave={handleSaveCurrentLocation}
      />

      <ManualLocationDialog
        open={showManualDialog}
        onClose={() => setShowManualDialog(false)}
        onSave={(name, latitude, longitude, radius) => {
          void handleSaveManualLocation(name, latitude, longitude, radius)
        }}
      />
    </section>
  )
}
