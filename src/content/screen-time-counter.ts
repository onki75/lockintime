import { getUsageLevel } from '../lib/screen-time'

type ScreenTimeCheckResponse = {
  tracked: boolean
  todayMinutes: number
  goalMinutes: number | null
}

type ScreenTimeHeartbeatResponse = {
  ok: boolean
  todayMinutes: number
  goalMinutes: number | null
}

const COUNTER_SELECTOR = '[data-lockintime-screen-time]'
const DEFAULT_BACKGROUND = 'rgba(15,23,42,0.85)'
const BACKGROUND_BY_USAGE_LEVEL = {
  low: 'rgba(16,185,129,0.85)',
  moderate: 'rgba(245,158,11,0.85)',
  high: 'rgba(249,115,22,0.85)',
  exceeded: 'rgba(239,68,68,0.85)',
} as const

function isHtmlDocument(): boolean {
  const contentType = document.contentType ?? ''
  return contentType.includes('text/html')
}

export function formatSessionTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes + ':' + String(seconds).padStart(2, '0')
}

export function formatTodayMinutes(minutes: number): string {
  if (minutes < 1) {
    return '0分'
  }

  if (minutes < 60) {
    return Math.floor(minutes) + '分'
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.floor(minutes % 60)
  return hours + '時間' + (remainingMinutes > 0 ? remainingMinutes + '分' : '')
}

function getCounterBackground(todayMinutes: number, goalMinutes: number | null): string {
  if (goalMinutes === null) {
    return DEFAULT_BACKGROUND
  }

  return BACKGROUND_BY_USAGE_LEVEL[getUsageLevel(todayMinutes, goalMinutes)]
}

function appendWhenReady(node: HTMLElement): void {
  if (document.body) {
    document.body.appendChild(node)
    return
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      document.body?.appendChild(node)
    },
    { once: true },
  )
}

async function requestScreenTimeCheck(
  hostname: string,
): Promise<ScreenTimeCheckResponse | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null
  }

  try {
    return (await chrome.runtime.sendMessage({
      type: 'screen-time:check',
      hostname,
    })) as ScreenTimeCheckResponse
  } catch {
    return null
  }
}

async function requestScreenTimeHeartbeat(
  hostname: string,
  sessionMs: number,
): Promise<ScreenTimeHeartbeatResponse | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null
  }

  try {
    return (await chrome.runtime.sendMessage({
      type: 'screen-time:heartbeat',
      hostname,
      sessionMs,
    })) as ScreenTimeHeartbeatResponse
  } catch {
    return null
  }
}

function createCounterUI(): {
  root: HTMLDivElement
  sessionText: HTMLDivElement
  todayMinutesText: HTMLDivElement
} {
  const root = document.createElement('div')
  root.setAttribute('data-lockintime-screen-time', 'true')
  root.style.position = 'fixed'
  root.style.right = '16px'
  root.style.bottom = '16px'
  root.style.zIndex = '2147483646'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.gap = '2px'
  root.style.padding = '8px 12px'
  root.style.borderRadius = '12px'
  root.style.color = '#ffffff'
  root.style.fontFamily = 'system-ui, sans-serif'
  root.style.fontVariantNumeric = 'tabular-nums'
  root.style.background = DEFAULT_BACKGROUND
  root.style.opacity = '0.6'
  root.style.transition = 'opacity 200ms ease'
  root.style.pointerEvents = 'auto'
  root.style.setProperty('backdrop-filter', 'blur(8px)')
  root.style.setProperty('-webkit-backdrop-filter', 'blur(8px)')
  root.addEventListener('mouseenter', () => {
    root.style.opacity = '1'
  })
  root.addEventListener('mouseleave', () => {
    root.style.opacity = '0.6'
  })

  const sessionText = document.createElement('div')
  sessionText.style.fontSize = '18px'
  sessionText.style.fontWeight = '700'
  root.appendChild(sessionText)

  const todayLabel = document.createElement('div')
  todayLabel.textContent = '今日'
  todayLabel.style.fontSize = '12px'
  todayLabel.style.opacity = '0.85'
  root.appendChild(todayLabel)

  const todayMinutesText = document.createElement('div')
  todayMinutesText.style.fontSize = '16px'
  todayMinutesText.style.fontWeight = '600'
  root.appendChild(todayMinutesText)

  return {
    root,
    sessionText,
    todayMinutesText,
  }
}

async function bootstrapScreenTimeCounter(): Promise<void> {
  if (!isHtmlDocument()) {
    return
  }

  const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()
  if (!hostname || document.querySelector(COUNTER_SELECTOR)) {
    return
  }

  const response = await requestScreenTimeCheck(hostname)
  if (!response?.tracked) {
    return
  }

  const existingCounter = document.querySelector(COUNTER_SELECTOR)
  if (existingCounter) {
    return
  }

  const { root, sessionText, todayMinutesText } = createCounterUI()
  let storedTodayMinutes = response.todayMinutes
  let goalMinutes = response.goalMinutes
  let accumulatedSessionMs = 0
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null
  let renderTimer: number | null = null
  let heartbeatTimer: number | null = null

  const getCurrentSessionMs = () =>
    accumulatedSessionMs + (visibleSince === null ? 0 : Date.now() - visibleSince)

  const getCurrentTodayMinutes = () => storedTodayMinutes + getCurrentSessionMs() / 60_000

  const render = () => {
    sessionText.textContent = `⏱ ${formatSessionTime(getCurrentSessionMs())}`
    todayMinutesText.textContent = formatTodayMinutes(getCurrentTodayMinutes())
    root.style.background = getCounterBackground(getCurrentTodayMinutes(), goalMinutes)
  }

  const clearTimers = () => {
    if (renderTimer !== null) {
      window.clearInterval(renderTimer)
      renderTimer = null
    }

    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const sendHeartbeat = async () => {
    const heartbeat = await requestScreenTimeHeartbeat(hostname, getCurrentSessionMs())
    if (!heartbeat?.ok) {
      return
    }

    storedTodayMinutes = heartbeat.todayMinutes
    goalMinutes = heartbeat.goalMinutes
    render()
  }

  const startVisibleTracking = () => {
    if (visibleSince !== null) {
      return
    }

    visibleSince = Date.now()
    render()
    renderTimer = window.setInterval(render, 1000)
    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat()
    }, 5000)
  }

  const stopVisibleTracking = () => {
    if (visibleSince === null) {
      return
    }

    accumulatedSessionMs += Date.now() - visibleSince
    visibleSince = null
    clearTimers()
    render()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startVisibleTracking()
      return
    }

    stopVisibleTracking()
  })
  window.addEventListener('pagehide', stopVisibleTracking, { once: true })

  render()
  appendWhenReady(root)

  if (document.visibilityState === 'visible') {
    renderTimer = window.setInterval(render, 1000)
    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat()
    }, 5000)
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    void bootstrapScreenTimeCounter().catch((error) => {
      console.error(error)
    })
  } catch (error) {
    console.error(error)
  }
}
