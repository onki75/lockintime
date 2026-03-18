import { describe, expect, it } from 'vitest'
import { isAllowedCheckoutUrl, normalizeRedirectHostname } from '../navigation'

describe('normalizeRedirectHostname', () => {
  it('accepts plain hostnames and rejects path injection', () => {
    expect(normalizeRedirectHostname('youtube.com')).toBe('youtube.com')
    expect(normalizeRedirectHostname('youtube.com/path')).toBeNull()
    expect(normalizeRedirectHostname('evil.com@youtube.com')).toBeNull()
  })
})

describe('isAllowedCheckoutUrl', () => {
  it('allows stripe checkout and same-origin callback urls only', () => {
    expect(
      isAllowedCheckoutUrl(
        'https://checkout.stripe.com/c/pay/test',
        'https://api.example.com/checkout',
      ),
    ).toBe(true)
    expect(
      isAllowedCheckoutUrl(
        'https://api.example.com/checkout/session/123',
        'https://api.example.com/checkout',
      ),
    ).toBe(true)
    expect(
      isAllowedCheckoutUrl(
        'https://phishing.example.net/checkout',
        'https://api.example.com/checkout',
      ),
    ).toBe(false)
  })
})
