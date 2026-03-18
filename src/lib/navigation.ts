function normalizeHostnameInput(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase()
}

export function normalizeRedirectHostname(value: string): string | null {
  const normalized = normalizeHostnameInput(value)
  if (!normalized || normalized.includes('/') || normalized.includes('?') || normalized.includes('#')) {
    return null
  }

  try {
    const parsed = new URL(`https://${normalized}`)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.hostname !== normalized
    ) {
      return null
    }

    return parsed.hostname
  } catch {
    return null
  }
}

export function isAllowedCheckoutUrl(
  candidate: string,
  checkoutEndpoint: string,
): boolean {
  try {
    const target = new URL(candidate)
    const endpoint = new URL(checkoutEndpoint)

    if (target.protocol !== 'https:') {
      return false
    }

    if (
      target.origin === endpoint.origin ||
      target.hostname === 'checkout.stripe.com' ||
      target.hostname === 'buy.stripe.com'
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}
