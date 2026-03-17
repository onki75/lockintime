import { describe, expect, it } from 'vitest'
import { buildCheckoutSessionParams, getCheckoutPriceId } from './checkout'

const catalog = {
  pro: {
    monthly: 'price_pro_monthly',
    yearly: 'price_pro_yearly',
    lifetime: 'price_pro_lifetime',
  },
  cloud: {
    monthly: 'price_cloud_monthly',
    yearly: 'price_cloud_yearly',
  },
} as const

describe('getCheckoutPriceId', () => {
  it('returns the matching price id from the catalog', () => {
    expect(getCheckoutPriceId(catalog, 'pro', 'monthly')).toBe('price_pro_monthly')
  })
})

describe('buildCheckoutSessionParams', () => {
  it('builds subscription params for recurring plans', () => {
    expect(
      buildCheckoutSessionParams(catalog, {
        uid: 'user-1',
        email: 'user@example.com',
        plan: 'cloud',
        interval: 'monthly',
        successBaseUrl: 'https://example.com/options',
        cancelBaseUrl: 'https://example.com/options',
      }),
    ).toEqual({
      mode: 'subscription',
      customer_email: 'user@example.com',
      client_reference_id: 'user-1',
      line_items: [{ price: 'price_cloud_monthly', quantity: 1 }],
      success_url: 'https://example.com/options?checkout=success',
      cancel_url: 'https://example.com/options?checkout=cancel',
      metadata: {
        uid: 'user-1',
        plan: 'cloud',
        interval: 'monthly',
      },
    })
  })

  it('builds payment params for lifetime plans', () => {
    expect(
      buildCheckoutSessionParams(catalog, {
        uid: 'user-1',
        email: 'user@example.com',
        plan: 'pro',
        interval: 'lifetime',
        successBaseUrl: 'https://example.com/options',
        cancelBaseUrl: 'https://example.com/options',
      }).mode,
    ).toBe('payment')
  })
})
