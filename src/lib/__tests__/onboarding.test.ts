import { beforeEach, describe, expect, it, vi } from 'vitest'

type StorageShape = {
  onboardingCompleted?: boolean
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
