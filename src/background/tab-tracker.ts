import { getHostnameFromUrl } from './access-counter'
import type { DailyStats } from '../lib/types'

type ActiveTabSession = {
  tabId: number
  hostname: string
  startedAt: number
}

type ActivatedInfo = {
  tabId: number
  windowId: number
}

type UpdatedTabInfo = {
  url?: string
  status?: string
}

type TabTrackerDependencies = {
  recordDuration: (
    hostname: string,
    durationMs: number,
    now: number,
  ) => Promise<DailyStats | null>
  syncRules: () => Promise<void>
  getTab: (tabId: number) => Promise<chrome.tabs.Tab>
  queryTabs: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
  now?: () => number
}

export function createTabTracker({
  recordDuration,
  syncRules,
  getTab,
  queryTabs,
  now = () => Date.now(),
}: TabTrackerDependencies) {
  let activeSession: ActiveTabSession | null = null
  let trackerQueue: Promise<void> = Promise.resolve()

  function queueTrackerOperation<T>(operation: () => Promise<T>): Promise<T> {
    const queued = trackerQueue.then(operation)
    trackerQueue = queued.then(
      () => undefined,
      () => undefined,
    )
    return queued
  }

  async function flushActiveSession(): Promise<void> {
    if (!activeSession) {
      return
    }

    const session = activeSession
    activeSession = null
    const recordedAt = now()
    const durationMs = recordedAt - session.startedAt

    const nextDailyStats = await recordDuration(session.hostname, durationMs, recordedAt)

    if (nextDailyStats) {
      await syncRules()
    }
  }

  async function startSessionForTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
    const nextTabId = tab?.id
    const nextUrl = tab?.url

    if (typeof nextTabId !== 'number' || typeof nextUrl !== 'string') {
      await flushActiveSession()
      return
    }

    const hostname = getHostnameFromUrl(nextUrl)
    if (!hostname) {
      await flushActiveSession()
      return
    }

    if (activeSession?.tabId === nextTabId && activeSession.hostname === hostname) {
      return
    }

    await flushActiveSession()
    activeSession = {
      tabId: nextTabId,
      hostname,
      startedAt: now(),
    }
  }

  return {
    async handleActivated(activeInfo: ActivatedInfo): Promise<void> {
      await queueTrackerOperation(async () => {
        const tab = await getTab(activeInfo.tabId)
        await startSessionForTab(tab)
      })
    },
    async handleUpdated(
      tabId: number,
      changeInfo: UpdatedTabInfo,
      tab: chrome.tabs.Tab,
    ): Promise<void> {
      await queueTrackerOperation(async () => {
        if (activeSession?.tabId !== tabId) {
          return
        }

        if (!changeInfo.url && changeInfo.status !== 'complete') {
          return
        }

        await startSessionForTab(tab)
      })
    },
    async handleWindowFocusChanged(windowId: number): Promise<void> {
      await queueTrackerOperation(async () => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
          await flushActiveSession()
          return
        }

        const [tab] = await queryTabs({ active: true, windowId })
        await startSessionForTab(tab)
      })
    },
    async handleRemoved(tabId: number): Promise<void> {
      await queueTrackerOperation(async () => {
        if (activeSession?.tabId === tabId) {
          await flushActiveSession()
        }
      })
    },
    async flush(): Promise<void> {
      await queueTrackerOperation(flushActiveSession)
    },
    markRecorded(hostname: string): void {
      if (activeSession?.hostname === hostname) {
        activeSession.startedAt = now()
      }
    },
  }
}
