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

type UsageLevel = keyof typeof BACKGROUND_BY_USAGE_LEVEL

function isHtmlDocument(): boolean {
  const contentType = document.contentType ?? ''
  return contentType.includes('text/html')
}

export function formatSessionTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
  }

  return minutes + ':' + String(seconds).padStart(2, '0')
}

export function formatTodayTime(minutes: number): string {
  return formatSessionTime(Math.max(0, minutes) * 60_000)
}

function getCounterBackground(todayMinutes: number, goalMinutes: number | null): string {
  if (goalMinutes === null) {
    return DEFAULT_BACKGROUND
  }

  return BACKGROUND_BY_USAGE_LEVEL[getUsageLevel(todayMinutes, goalMinutes)]
}

function getUsageLevel(currentMinutes: number, goalMinutes: number): UsageLevel {
  if (goalMinutes <= 0) {
    return currentMinutes > 0 ? 'exceeded' : 'low'
  }

  const usageRatio = currentMinutes / goalMinutes

  if (usageRatio < 0.5) {
    return 'low'
  }

  if (usageRatio < 0.8) {
    return 'moderate'
  }

  if (usageRatio <= 1) {
    return 'high'
  }

  return 'exceeded'
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

export function clampCounterPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  return {
    left: Math.min(Math.max(0, left), Math.max(0, viewportWidth - width)),
    top: Math.min(Math.max(0, top), Math.max(0, viewportHeight - height)),
  }
}

export function getCursorCounterPosition(
  cursorX: number,
  cursorY: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  offset = 16,
): { left: number; top: number } {
  const preferredLeft = cursorX + offset
  const left = preferredLeft + width <= viewportWidth
    ? preferredLeft
    : cursorX - width - offset

  return clampCounterPosition(
    left,
    cursorY + offset,
    width,
    height,
    viewportWidth,
    viewportHeight,
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
  sessionId: string,
  sessionMs: number,
): Promise<ScreenTimeHeartbeatResponse | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null
  }

  try {
    return (await chrome.runtime.sendMessage({
      type: 'screen-time:heartbeat',
      hostname,
      sessionId,
      sessionMs,
    })) as ScreenTimeHeartbeatResponse
  } catch {
    return null
  }
}

function createCounterUI(): {
  root: HTMLDivElement
  todayMinutesText: HTMLDivElement
} {
  const root = document.createElement('div')
  root.setAttribute('data-lockintime-screen-time', 'true')
  root.style.position = 'fixed'
  root.style.right = '16px'
  root.style.bottom = '16px'
  root.style.zIndex = '2147483646'
  root.style.display = 'flex'
  root.style.alignItems = 'center'
  root.style.padding = '8px 12px'
  root.style.borderRadius = '999px'
  root.style.color = '#ffffff'
  root.style.fontFamily = 'system-ui, sans-serif'
  root.style.fontVariantNumeric = 'tabular-nums'
  root.style.background = DEFAULT_BACKGROUND
  root.style.opacity = '0.72'
  root.style.transition = 'opacity 200ms ease'
  root.style.pointerEvents = 'none'
  root.style.whiteSpace = 'nowrap'
  root.style.setProperty('backdrop-filter', 'blur(8px)')
  root.style.setProperty('-webkit-backdrop-filter', 'blur(8px)')

  const todayMinutesText = document.createElement('div')
  todayMinutesText.style.fontSize = '14px'
  todayMinutesText.style.fontWeight = '700'
  root.appendChild(todayMinutesText)

  return {
    root,
    todayMinutesText,
  }
}

function followCursor(root: HTMLElement): void {
  document.addEventListener('pointermove', (event) => {
    const rect = root.getBoundingClientRect()
    const position = getCursorCounterPosition(
      event.clientX,
      event.clientY,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
    )

    root.style.left = `${position.left}px`
    root.style.top = `${position.top}px`
    root.style.right = 'auto'
    root.style.bottom = 'auto'
    root.style.opacity = '0.92'
  })
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

  const { root, todayMinutesText } = createCounterUI()
  followCursor(root)
  const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
  let storedTodayMinutes = response.todayMinutes
  let goalMinutes = response.goalMinutes
  let accumulatedSessionMs = 0
  let syncedSessionMs = 0
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null
  let renderTimer: number | null = null
  let heartbeatTimer: number | null = null

  const getCurrentSessionMs = () =>
    accumulatedSessionMs + (visibleSince === null ? 0 : Date.now() - visibleSince)

  const getCurrentTodayMinutes = () =>
    storedTodayMinutes + Math.max(0, getCurrentSessionMs() - syncedSessionMs) / 60_000

  const render = () => {
    todayMinutesText.textContent = `⏱ 今日 ${formatTodayTime(getCurrentTodayMinutes())}`
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
    const currentSessionMs = getCurrentSessionMs()
    const heartbeat = await requestScreenTimeHeartbeat(hostname, sessionId, currentSessionMs)
    if (!heartbeat?.ok) {
      return
    }

    storedTodayMinutes = heartbeat.todayMinutes
    goalMinutes = heartbeat.goalMinutes
    syncedSessionMs = currentSessionMs
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
