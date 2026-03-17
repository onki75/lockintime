import type { LicensePlan } from './license'

export type BillingInterval = 'monthly' | 'yearly' | 'lifetime'

export type CheckoutPlan = Extract<LicensePlan, 'pro' | 'cloud'>

export type PriceCatalog = {
  pro: Partial<Record<BillingInterval, string>>
  cloud: Partial<Record<Exclude<BillingInterval, 'lifetime'>, string>>
}

export type CheckoutRequest = {
  uid: string
  email: string
  plan: CheckoutPlan
  interval: BillingInterval
  successBaseUrl: string
  cancelBaseUrl: string
}

export type CheckoutSessionParams = {
  mode: 'payment' | 'subscription'
  customer_email: string
  client_reference_id: string
  line_items: Array<{
    price: string
    quantity: 1
  }>
  success_url: string
  cancel_url: string
  metadata: {
    uid: string
    plan: CheckoutPlan
    interval: BillingInterval
  }
}

export function getCheckoutPriceId(
  catalog: PriceCatalog,
  plan: CheckoutPlan,
  interval: BillingInterval,
): string {
  const priceId = catalog[plan][interval as keyof (typeof catalog)[typeof plan]]
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
    client_reference_id: request.uid,
    line_items: [
      {
        price,
        quantity: 1,
      },
    ],
    success_url: withCheckoutStatus(request.successBaseUrl, 'success'),
    cancel_url: withCheckoutStatus(request.cancelBaseUrl, 'cancel'),
    metadata: {
      uid: request.uid,
      plan: request.plan,
      interval: request.interval,
    },
  }
}
