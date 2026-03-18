type DelayGateResponse = {
  ok: boolean
  gate?: {
    ruleId: string
    delaySeconds: number
    matchedDomain: string
  } | null
}

const SESSION_PREFIX = 'lockintime:delay-gate:'

function isHtmlDocument(): boolean {
  const contentType = document.contentType ?? ''
  return contentType.includes('text/html')
}

function getSessionKey(ruleId: string, hostname: string): string {
  return `${SESSION_PREFIX}${ruleId}:${hostname}`
}

function hasCompletedGate(ruleId: string, hostname: string): boolean {
  try {
    return sessionStorage.getItem(getSessionKey(ruleId, hostname)) === 'done'
  } catch {
    return false
  }
}

function markGateComplete(ruleId: string, hostname: string): void {
  try {
    sessionStorage.setItem(getSessionKey(ruleId, hostname), 'done')
  } catch {
    // ignore session storage failures
  }
}

function createOverlay(delaySeconds: number, onContinue: () => void): HTMLElement {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-lockintime-delay-gate', 'true')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '2147483647'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.background =
    'radial-gradient(circle at top, rgba(37,99,235,0.18), transparent 44%), rgba(15,23,42,0.9)'
  overlay.style.backdropFilter = 'blur(18px)'

  const card = document.createElement('div')
  card.style.width = 'min(480px, calc(100vw - 32px))'
  card.style.borderRadius = '28px'
  card.style.background = 'rgba(255,255,255,0.96)'
  card.style.padding = '28px'
  card.style.boxShadow = '0 24px 70px rgba(15,23,42,0.28)'
  card.style.fontFamily = '"Hiragino Sans", "Yu Gothic", sans-serif'
  overlay.appendChild(card)

  const eyebrow = document.createElement('p')
  eyebrow.textContent = 'Delay Gate'
  eyebrow.style.margin = '0 0 10px'
  eyebrow.style.fontSize = '12px'
  eyebrow.style.fontWeight = '700'
  eyebrow.style.letterSpacing = '0.18em'
  eyebrow.style.textTransform = 'uppercase'
  eyebrow.style.color = '#64748b'
  card.appendChild(eyebrow)

  const title = document.createElement('h1')
  title.textContent = 'いま本当に開く必要があるかを待って確認します'
  title.style.margin = '0 0 12px'
  title.style.fontSize = '28px'
  title.style.lineHeight = '1.2'
  title.style.fontWeight = '800'
  title.style.color = '#0f172a'
  card.appendChild(title)

  const body = document.createElement('p')
  body.textContent = '衝動的な遷移を止めるため、短い待機時間を入れています。'
  body.style.margin = '0'
  body.style.fontSize = '14px'
  body.style.lineHeight = '1.7'
  body.style.color = '#475569'
  card.appendChild(body)

  const countdown = document.createElement('div')
  countdown.style.margin = '20px 0 0'
  countdown.style.fontSize = '48px'
  countdown.style.fontWeight = '800'
  countdown.style.color = '#2563eb'
  countdown.style.fontVariantNumeric = 'tabular-nums'
  card.appendChild(countdown)

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'サイトを開く'
  button.disabled = true
  button.style.marginTop = '20px'
  button.style.width = '100%'
  button.style.border = '0'
  button.style.borderRadius = '18px'
  button.style.padding = '14px 18px'
  button.style.fontSize = '15px'
  button.style.fontWeight = '700'
  button.style.cursor = 'pointer'
  button.style.color = '#ffffff'
  button.style.background = '#94a3b8'
  button.style.transition = 'transform 160ms ease, background 160ms ease'
  button.addEventListener('click', onContinue)
  card.appendChild(button)

  let remaining = delaySeconds
  const updateCountdown = () => {
    countdown.textContent = `${remaining}s`
    if (remaining <= 0) {
      button.disabled = false
      button.style.background = '#2563eb'
      return
    }

    remaining -= 1
    window.setTimeout(updateCountdown, 1000)
  }

  updateCountdown()
  return overlay
}

async function requestDelayGate(hostname: string): Promise<DelayGateResponse | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null
  }

  return (await chrome.runtime.sendMessage({
    type: 'delay:should-gate',
    hostname,
  })) as DelayGateResponse
}

async function bootstrapDelayGate(): Promise<void> {
  if (!isHtmlDocument()) {
    return
  }

  const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()
  if (!hostname) {
    return
  }

  const response = await requestDelayGate(hostname)
  const gate = response?.ok ? response.gate : null

  if (!gate || hasCompletedGate(gate.ruleId, hostname)) {
    return
  }

  document.documentElement.style.overflow = 'hidden'
  const overlay = createOverlay(gate.delaySeconds, () => {
    markGateComplete(gate.ruleId, hostname)
    overlay.remove()
    document.documentElement.style.overflow = ''
  })

  if (document.body) {
    document.body.appendChild(overlay)
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        document.body.appendChild(overlay)
      },
      { once: true },
    )
  }
}

try {
  void bootstrapDelayGate().catch((error) => {
    console.error(error)
  })
} catch (error) {
  console.error(error)
}
