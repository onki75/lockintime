import { beforeEach, describe, expect, it, vi } from 'vitest'

type StorageShape = {
  trialStartDate?: number
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function createChromeStorageMock(initialState: StorageShape = {}) {
  let state: StorageShape = structuredClone(initialState)

  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: key in state ? state[key as keyof StorageShape] : undefined,
        })),
        set: vi.fn(async (data: Partial<StorageShape>) => {
          state = {
            ...state,
            ...structuredClone(data),
          }
        }),
      },
    },
  }
}

async function loadTrialModule(initialState: StorageShape = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubGlobal('chrome', createChromeStorageMock(initialState))

  return import('../trial')
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('startTrial', () => {
  it('saves the current timestamp to chrome.storage.local', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const { startTrial } = await loadTrialModule()

    await startTrial()

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      trialStartDate: 1_700_000_000_000,
    })
  })
})

describe('getTrialStartDate', () => {
  it('returns null when the trial has not started', async () => {
    const { getTrialStartDate } = await loadTrialModule()

    await expect(getTrialStartDate()).resolves.toBeNull()
  })

  it('returns the saved trial start date', async () => {
    const { getTrialStartDate } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(getTrialStartDate()).resolves.toBe(1_700_000_000_000)
  })
})

describe('isTrialActive', () => {
  it('returns false when the trial has not started', async () => {
    const { isTrialActive } = await loadTrialModule()

    await expect(isTrialActive()).resolves.toBe(false)
  })

  it('returns true when within 7 days from the start date', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + 6 * DAY_IN_MS)
    const { isTrialActive } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(isTrialActive()).resolves.toBe(true)
  })

  it('returns false exactly 7 days after the start date', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + 7 * DAY_IN_MS)
    const { isTrialActive } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(isTrialActive()).resolves.toBe(false)
  })
})

describe('getTrialDaysRemaining', () => {
  it('returns 0 when the trial has not started', async () => {
    const { getTrialDaysRemaining } = await loadTrialModule()

    await expect(getTrialDaysRemaining()).resolves.toBe(0)
  })

  it('returns 7 immediately after the trial starts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const { getTrialDaysRemaining } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(getTrialDaysRemaining()).resolves.toBe(7)
  })

  it('rounds up partial remaining days to an integer', async () => {
    vi
      .spyOn(Date, 'now')
      .mockReturnValue(1_700_000_000_000 + 6 * DAY_IN_MS + 1)
    const { getTrialDaysRemaining } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(getTrialDaysRemaining()).resolves.toBe(1)
  })

  it('never returns a negative value after expiry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + 10 * DAY_IN_MS)
    const { getTrialDaysRemaining } = await loadTrialModule({
      trialStartDate: 1_700_000_000_000,
    })

    await expect(getTrialDaysRemaining()).resolves.toBe(0)
  })
})
