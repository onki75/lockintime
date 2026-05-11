import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../defaults'

type StorageShape = {
  onboardingCompleted?: boolean
  settings?: unknown
  trialStartDate?: number
}

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function createChromeMock(initialState: StorageShape = {}) {
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
        set: vi.fn(async (data: Partial<StorageShape>) => {
          state = {
            ...state,
            ...deepClone(data),
          }
        }),
      },
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
  }
}

async function loadOnboardingModule(initialState: StorageShape = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubGlobal('chrome', createChromeMock(initialState))
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'test-rule-id'),
  })

  return import('../onboarding')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('shouldShowOnboarding', () => {
  it('returns true when onboardingCompleted is not set', async () => {
    const { shouldShowOnboarding } = await loadOnboardingModule()

    await expect(shouldShowOnboarding()).resolves.toBe(true)
  })

  it('returns true when onboardingCompleted is false', async () => {
    const { shouldShowOnboarding } = await loadOnboardingModule({
      onboardingCompleted: false,
    })

    await expect(shouldShowOnboarding()).resolves.toBe(true)
  })

  it('returns false when onboardingCompleted is true', async () => {
    const { shouldShowOnboarding } = await loadOnboardingModule({
      onboardingCompleted: true,
    })

    await expect(shouldShowOnboarding()).resolves.toBe(false)
  })
})

describe('completeOnboarding', () => {
  it('stores onboardingCompleted as true', async () => {
    const { completeOnboarding, shouldShowOnboarding } = await loadOnboardingModule()

    await completeOnboarding()

    await expect(shouldShowOnboarding()).resolves.toBe(false)
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      onboardingCompleted: true,
    })
  })
})

describe('resetOnboarding', () => {
  it('stores onboardingCompleted as false', async () => {
    const { resetOnboarding, shouldShowOnboarding } = await loadOnboardingModule({
      onboardingCompleted: true,
    })

    await resetOnboarding()

    await expect(shouldShowOnboarding()).resolves.toBe(true)
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      onboardingCompleted: false,
    })
  })
})

describe('getOnboardingUrl', () => {
  it('returns the options onboarding URL from chrome.runtime.getURL', async () => {
    const { getOnboardingUrl } = await loadOnboardingModule()

    expect(getOnboardingUrl()).toBe(
      'chrome-extension://test/options.html?onboarding=true',
    )
    expect(chrome.runtime.getURL).toHaveBeenCalledWith(
      'options.html?onboarding=true',
    )
  })
})

describe('finishOnboarding', () => {
  it('stores every selected site, starts the trial, and marks onboarding complete', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

    try {
      const { finishOnboarding, shouldShowOnboarding } = await loadOnboardingModule({
        settings: DEFAULT_SETTINGS,
      })
      const { getSettings } = await import('../storage')
      const { getTrialStartDate } = await import('../trial')

      await expect(
        finishOnboarding(['youtube.com', 'x.com']),
      ).resolves.toEqual({
        blockedCount: 2,
        onboardingCompleted: true,
      })

      const settings = await getSettings()

      expect(settings.blockRules).toHaveLength(2)
      expect(settings.blockRules).toEqual([
        expect.objectContaining({
          type: 'site',
          url: 'youtube.com',
          restrictions: [{ type: 'full_block' }],
        }),
        expect.objectContaining({
          type: 'site',
          url: 'x.com',
          restrictions: [{ type: 'full_block' }],
        }),
      ])
      await expect(getTrialStartDate()).resolves.toBe(1_700_000_000_000)
      await expect(shouldShowOnboarding()).resolves.toBe(false)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('deduplicates selected sites and continues when one site fails to add', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { finishOnboarding, shouldShowOnboarding } = await loadOnboardingModule({
        settings: {
          ...DEFAULT_SETTINGS,
          blockRules: [
            {
              id: 'existing-rule',
              type: 'site',
              url: 'youtube.com',
              restrictions: [{ type: 'full_block' }],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      })
      const { getSettings } = await import('../storage')

      await expect(
        finishOnboarding(['youtube.com', 'youtube.com', 'x.com']),
      ).resolves.toEqual({
        blockedCount: 1,
        onboardingCompleted: true,
      })

      const settings = await getSettings()

      expect(settings.blockRules).toEqual([
        expect.objectContaining({
          type: 'site',
          url: 'youtube.com',
        }),
        expect.objectContaining({
          type: 'site',
          url: 'x.com',
        }),
      ])
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LockInTime: failed to add onboarding site rule',
        expect.objectContaining({
          site: 'youtube.com',
          error: expect.any(Error),
        }),
      )
      await expect(shouldShowOnboarding()).resolves.toBe(false)
    } finally {
      consoleErrorSpy.mockRestore()
      nowSpy.mockRestore()
    }
  })
})
