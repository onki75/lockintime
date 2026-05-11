import { getHostnameFromUrl, recordDurationForHostname } from './access-counter'
import type { BlockRule, DailyStats } from '../lib/types'

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
  getRules: () => Promise<BlockRule[]>
  getDailyStats: () => Promise<DailyStats | null>
  saveDailyStats: (dailyStats: DailyStats) => Promise<void>
  syncRules: () => Promise<void>
  getTab: (tabId: number) => Promise<chrome.tabs.Tab>
  queryTabs: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
  now?: () => number
}

export function createTabTracker({
  getRules,
  getDailyStats,
  saveDailyStats,
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

    const durationMs = now() - activeSession.startedAt
    const [rules, dailyStats] = await Promise.all([getRules(), getDailyStats()])
    const nextDailyStats = recordDurationForHostname(
      activeSession.hostname,
      rules,
      dailyStats,
      durationMs,
      new Date(now()),
    )

    activeSession = null

    if (!nextDailyStats) {
      return
    }

    await saveDailyStats(nextDailyStats)
    await syncRules()
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
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await flushActiveSession()
        return
      }

      const [tab] = await queryTabs({ active: true, windowId })
      await startSessionForTab(tab)
    },
    async handleRemoved(tabId: number): Promise<void> {
      await queueTrackerOperation(async () => {
        if (activeSession?.tabId === tabId) {
          await flushActiveSession()
        }
      })
    },
    async flush(): Promise<void> {
      await flushActiveSession()
    },
    markRecorded(hostname: string): void {
      if (activeSession?.hostname === hostname) {
        activeSession.startedAt = now()
      }
    },
  }
}
