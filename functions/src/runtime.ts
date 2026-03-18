import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import Stripe from 'stripe'
import {
  buildCheckoutSessionParams,
  type BillingInterval,
  type CheckoutPlan,
  type CheckoutRequest,
  type PriceCatalog,
} from './checkout'
import { buildCleanupPlan } from './cleanup'
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
  return value === 'pro' || value === 'cloud'
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
    typeof value.uid !== 'string' ||
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

async function applyLicenseProjection(
  projection: ReturnType<typeof projectLicenseFromStripeEvent>,
): Promise<void> {
  ensureAdminApp()
  const firestore = getFirestore()
  const licenseRef = firestore.doc(`users/${projection.uid}/licenses/current`)
  const currentLicenseSnap = await licenseRef.get()
  const currentPlan = (currentLicenseSnap.data()?.plan as LicensePlan | undefined) ?? 'free'
  const existingDowngradedAt = currentLicenseSnap.data()?.downgradedFromCloudAt

  const downgradedFromCloudAt =
    currentPlan === 'cloud' && projection.plan !== 'cloud'
      ? projection.record.updatedAt
      : projection.plan === 'cloud'
        ? null
        : (typeof existingDowngradedAt === 'number' ? existingDowngradedAt : null)

  await Promise.all([
    licenseRef.set({
      ...projection.record,
      downgradedFromCloudAt,
    }),
    firestore.doc(`users/${projection.uid}/meta/stripe`).set({
      lastEventId: projection.eventId,
      updatedAt: projection.record.updatedAt,
      updatedBy: 'stripe',
      lastProcessedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ])
}

export const createCheckoutSession = onRequest(async (request, response) => {
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

    await applyLicenseProjection(projection)
    response.status(200).json({ ok: true, uid: projection.uid, plan: projection.plan })
  } catch (error) {
    response.status(400).json({ error: (error as Error).message })
  }
})

export const cleanupExpiredCloudData = onSchedule('every day 03:00', async () => {
  ensureAdminApp()
  const firestore = getFirestore()
  const usersSnapshot = await firestore.collection('users').get()

  for (const userDoc of usersSnapshot.docs) {
    const licenseSnap = await userDoc.ref.collection('licenses').doc('current').get()
    const data = licenseSnap.data()
    if (!data) {
      continue
    }

    const cleanupPlan = buildCleanupPlan({
      plan: (data.plan as LicensePlan | undefined) ?? 'free',
      downgradedFromCloudAt:
        typeof data.downgradedFromCloudAt === 'number'
          ? data.downgradedFromCloudAt
          : null,
    })

    if (!cleanupPlan.shouldDelete) {
      continue
    }

    await Promise.all([
      firestore.recursiveDelete(userDoc.ref.collection('dailyStats')),
      userDoc.ref.collection('streak').doc('data').delete().catch(() => undefined),
      userDoc.ref.collection('runtime').doc('cooldown').delete().catch(() => undefined),
      userDoc.ref.collection('meta').doc('sync').delete().catch(() => undefined),
      userDoc.ref.collection('tombstones').doc('current').delete().catch(() => undefined),
    ])
  }
})
