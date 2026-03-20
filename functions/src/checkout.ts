import type { LicensePlan } from './license'

export type BillingInterval = 'monthly' | 'yearly' | 'lifetime'

export type CheckoutPlan = Extract<LicensePlan, 'pro'>

export type PriceCatalog = {
  pro: Partial<Record<BillingInterval, string>>
}

export type CheckoutRequest = {
  email: string
  plan: CheckoutPlan
  interval: BillingInterval
  successBaseUrl: string
  cancelBaseUrl: string
}

export type CheckoutSessionParams = {
  mode: 'payment' | 'subscription'
  customer_email: string
  line_items: Array<{
    price: string
    quantity: 1
  }>
  success_url: string
  cancel_url: string
  metadata: {
    email: string
    plan: CheckoutPlan
    interval: BillingInterval
  }
}

export function getCheckoutPriceId(
  catalog: PriceCatalog,
  plan: CheckoutPlan,
  interval: BillingInterval,
): string {
  const priceId = catalog[plan][interval]
  if (!priceId) {
    throw new Error(`Missing Stripe price for ${plan}:${interval}`)
  }

  return priceId
}

function withCheckoutStatus(url: string, status: 'success' | 'cancel'): string {
  const target = new URL(url)
  target.searchParams.set('checkout', status)
  return target.toString()
}

export function buildCheckoutSessionParams(
  catalog: PriceCatalog,
  request: CheckoutRequest,
): CheckoutSessionParams {
  const price = getCheckoutPriceId(catalog, request.plan, request.interval)
  const mode = request.interval === 'lifetime' ? 'payment' : 'subscription'

  return {
    mode,
    customer_email: request.email,
    line_items: [
      {
        price,
        quantity: 1,
      },
    ],
    success_url: withCheckoutStatus(request.successBaseUrl, 'success'),
    cancel_url: withCheckoutStatus(request.cancelBaseUrl, 'cancel'),
    metadata: {
      email: request.email,
      plan: request.plan,
      interval: request.interval,
    },
  }
}
