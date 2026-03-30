import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LicenseCache } from '../types'

const getLicenseCacheMock = vi.fn()
const saveLicenseCacheMock = vi.fn()

async function loadLicenseModule(initialCache?: LicenseCache) {
  vi.resetModules()
  vi.doMock('../storage', () => ({
    getLicenseCache: getLicenseCacheMock,
    saveLicenseCache: saveLicenseCacheMock,
  }))

  getLicenseCacheMock.mockResolvedValue(
    initialCache ?? {
      plan: 'free',
      lastVerified: null,
      source: 'default',
      expiresAt: null, email: null,
    },
  )
  saveLicenseCacheMock.mockResolvedValue(undefined)

  return import('../license')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEffectiveLicensePlan', () => {
  it('keeps pro access during the offline grace period', async () => {
    const now = Date.UTC(2026, 2, 16)
    const { getEffectiveLicensePlan } = await loadLicenseModule({
      plan: 'pro',
      lastVerified: now - 10 * 24 * 60 * 60 * 1000,
      source: 'cloud',
      expiresAt: null, email: null,
    })

    await expect(getEffectiveLicensePlan(now)).resolves.toBe('pro')
  })

  it('falls back to free after the offline grace period expires', async () => {
    const now = Date.UTC(2026, 2, 16)
    const { getEffectiveLicensePlan } = await loadLicenseModule({
      plan: 'pro',
      lastVerified: now - 31 * 24 * 60 * 60 * 1000,
      source: 'cloud',
      expiresAt: null, email: null,
    })

    await expect(getEffectiveLicensePlan(now)).resolves.toBe('free')
  })
})

describe('refreshLicenseCache', () => {
  it('stores the newly verified pro plan and timestamp', async () => {
    const now = Date.UTC(2026, 2, 16)
    const { refreshLicenseCache } = await loadLicenseModule()

    const cache = await refreshLicenseCache('pro', now)

    expect(cache).toEqual({
      plan: 'pro',
      lastVerified: now,
      source: 'cloud',
      expiresAt: null, email: null,
    })
    expect(saveLicenseCacheMock).toHaveBeenCalledWith(cache)
  })
})
