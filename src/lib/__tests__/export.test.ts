import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { DEFAULT_LOCK_MODE } from '../defaults'

type StorageShape = {
  settings?: unknown
}

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function createChromeStorageMock(initialState: StorageShape = {}) {
  let state = deepClone(initialState)

  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]:
            key in state
              ? deepClone(state[key as keyof StorageShape])
              : undefined,
        })),
        set: vi.fn(async (data: Record<string, unknown>) => {
          state = {
            ...state,
            ...deepClone(data),
          }
        }),
      },
    },
  }
}

const validSettings: Settings = {
  blockRules: [
    {
      id: 'rule-1',
      type: 'site',
      url: 'youtube.com',
      enabled: true,
      restrictions: [{ type: 'full_block' }],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ],
  adultFilter: true,
  locations: [
    {
      id: 'loc-1',
      name: 'Office',
      latitude: 35.6812,
      longitude: 139.7671,
      radiusMeters: 100,
      updatedAt: 1700000000000,
    },
  ],
  streakDisplayMode: 'heatmap',
  customQuotes: [],
  lockMode: DEFAULT_LOCK_MODE,
  updatedAt: 1700000000000,
}

async function loadExportModule(initialState: StorageShape = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-16T12:34:56.000Z'))

  vi.stubGlobal('chrome', createChromeStorageMock(initialState))

  return import('../export')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('validateSettings', () => {
  it('returns true for valid settings', async () => {
    const { validateSettings } = await loadExportModule()

    expect(validateSettings(validSettings)).toBe(true)
  })

  it('returns false for invalid settings', async () => {
    const { validateSettings } = await loadExportModule()

    expect(
      validateSettings({
        ...validSettings,
        adultFilter: 'yes',
      }),
    ).toBe(false)
  })
})

describe('exportSettings', () => {
  it('returns pretty-printed JSON with version and exportedAt', async () => {
    const { exportSettings } = await loadExportModule({
      settings: validSettings,
    })

    const json = await exportSettings()
    const parsed = JSON.parse(json)

    expect(parsed).toEqual({
      version: 1,
      exportedAt: '2026-03-16T12:34:56.000Z',
      settings: validSettings,
    })
    expect(json).toContain('\n  "version": 1,\n')
  })
})

describe('importSettings', () => {
  it('parses exported JSON and saves settings into chrome.storage.local', async () => {
    const { importSettings } = await loadExportModule()

    await importSettings(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-03-16T12:34:56.000Z',
        settings: validSettings,
      }),
    )

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      settings: validSettings,
    })
  })

  it('throws for invalid export payload', async () => {
    const { importSettings } = await loadExportModule()

    await expect(
      importSettings(
        JSON.stringify({
          version: 2,
          exportedAt: '2026-03-16T12:34:56.000Z',
          settings: validSettings,
        }),
      ),
    ).rejects.toThrow(/invalid/i)
  })

  it('throws for invalid settings data', async () => {
    const { importSettings } = await loadExportModule()

    await expect(
      importSettings(
        JSON.stringify({
          version: 1,
          exportedAt: '2026-03-16T12:34:56.000Z',
          settings: {
            ...validSettings,
            blockRules: [{ id: 'broken' }],
          },
        }),
      ),
    ).rejects.toThrow(/invalid/i)
  })
})
