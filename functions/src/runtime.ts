import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import Stripe from 'stripe'
import {
  buildCheckoutSessionParams,
  type BillingInterval,
  type CheckoutPlan,
  type CheckoutRequest,
  type PriceCatalog,
} from './checkout'
import type { LicensePlan } from './license'
import { projectLicenseFromStripeEvent, type StripeEventShape } from './webhook'

function ensureAdminApp(): void {
  if (getApps().length === 0) {
    initializeApp()
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function getStripeClient(): Stripe {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'))
}

function getPriceCatalog(): PriceCatalog {
  const raw = requireEnv('STRIPE_PRICE_CATALOG_JSON')
  return JSON.parse(raw) as PriceCatalog
}

function getPriceIdToPlan(catalog: PriceCatalog): Record<string, LicensePlan> {
  const mapping: Record<string, LicensePlan> = {}

  for (const [plan, intervals] of Object.entries(catalog) as Array<[CheckoutPlan, Record<string, string>]>) {
    for (const priceId of Object.values(intervals)) {
      if (priceId) {
        mapping[priceId] = plan
      }
    }
  }

  return mapping
}

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === 'pro'
}

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'yearly' || value === 'lifetime'
}

function parseCheckoutRequest(body: unknown): CheckoutRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid checkout request body')
  }

  const value = body as Partial<CheckoutRequest>
  if (
    typeof value.email !== 'string' ||
    !isCheckoutPlan(value.plan) ||
    !isBillingInterval(value.interval) ||
    typeof value.successBaseUrl !== 'string' ||
    typeof value.cancelBaseUrl !== 'string'
  ) {
    throw new Error('Checkout request is missing required fields')
  }

  return value as CheckoutRequest
}

async function saveLicenseByEmail(
  email: string,
  plan: LicensePlan,
  eventId: string,
): Promise<void> {
  ensureAdminApp()
  const firestore = getFirestore()
  const normalizedEmail = email.toLowerCase().trim()

  await firestore.doc(`licenses/${normalizedEmail}`).set({
    email: normalizedEmail,
    plan,
    eventId,
    updatedAt: Date.now(),
  }, { merge: true })
}

export const createCheckoutSession = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.set('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.status(204).send('')
    return
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const checkoutRequest = parseCheckoutRequest(request.body)
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams(getPriceCatalog(), checkoutRequest) as Stripe.Checkout.SessionCreateParams,
    )

    if (!session.url) {
      response.status(502).json({ error: 'Stripe checkout session did not return a URL' })
      return
    }

    response.status(200).json({ url: session.url })
  } catch (error) {
    response.status(400).json({ error: (error as Error).message })
  }
})

export const stripeWebhook = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const stripe = getStripeClient()
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET')
    const signature = request.header('stripe-signature')
    const event = signature
      ? stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret)
      : (request.body as StripeEventShape)
    const projection = projectLicenseFromStripeEvent(
      event as StripeEventShape,
      getPriceIdToPlan(getPriceCatalog()),
      Date.now(),
    )

    await saveLicenseByEmail(projection.email, projection.plan, projection.eventId)
    response.status(200).json({ ok: true, email: projection.email, plan: projection.plan })
  } catch (error) {
    response.status(400).json({ error: (error as Error).message })
  }
})

export const verifyLicense = onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.set('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.status(204).send('')
    return
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email } = request.body as { email?: string }
    if (!email || typeof email !== 'string') {
      response.status(400).json({ error: 'Email is required' })
      return
    }

    ensureAdminApp()
    const firestore = getFirestore()
    const normalizedEmail = email.toLowerCase().trim()
    const doc = await firestore.doc(`licenses/${normalizedEmail}`).get()

    if (!doc.exists) {
      response.status(200).json({ plan: 'free' })
      return
    }

    const data = doc.data()
    response.status(200).json({
      plan: data?.plan ?? 'free',
      updatedAt: data?.updatedAt ?? null,
    })
  } catch (error) {
    response.status(500).json({ error: (error as Error).message })
  }
})
