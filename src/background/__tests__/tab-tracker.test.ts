import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTabTracker } from '../tab-tracker'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('chrome', {
    windows: {
      WINDOW_ID_NONE: -1,
    },
  })
})

describe('createTabTracker', () => {
  it('serializes focus flushes so the active session is recorded once', async () => {
    let now = 1_000
    let releaseRecord: (() => void) | undefined
    const recordStarted = vi.fn()
    const recordDuration = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          recordStarted()
          releaseRecord = () => resolve(null)
        }),
    )
    const tracker = createTabTracker({
      recordDuration,
      syncRules: vi.fn(async () => undefined),
      getTab: vi.fn(async () => ({
        id: 1,
        url: 'https://youtube.com/watch',
      }) as chrome.tabs.Tab),
      queryTabs: vi.fn(async () => []),
      now: () => now,
    })

    await tracker.handleActivated({ tabId: 1, windowId: 1 })
    now = 4_000

    const firstFlush = tracker.flush()
    await vi.waitFor(() => expect(recordStarted).toHaveBeenCalledTimes(1))
    const secondFlush = tracker.handleWindowFocusChanged(chrome.windows.WINDOW_ID_NONE)

    releaseRecord?.()
    await Promise.all([firstFlush, secondFlush])

    expect(recordDuration).toHaveBeenCalledTimes(1)
    expect(recordDuration).toHaveBeenCalledWith('youtube.com', 3_000, 4_000)
  })
})
