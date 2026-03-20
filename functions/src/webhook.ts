import { derivePlanFromPriceIds, projectLicenseRecord, type LicensePlan } from './license'

export type StripeEventShape = {
  id: string
  type: string
  data: {
    object: {
      customer_email?: string | null
      metadata?: {
        email?: string
      }
      lines?: {
        data?: Array<{
          price?: {
            id?: string | null
          }
        }>
      }
      items?: {
        data?: Array<{
          price?: {
            id?: string | null
          }
        }>
      }
    }
  }
}

export type LicenseProjection = {
  email: string
  plan: LicensePlan
  eventId: string
  record: ReturnType<typeof projectLicenseRecord>
}

function collectPriceIds(event: StripeEventShape): string[] {
  const inlineLinePrices = event.data.object.lines?.data ?? []
  const itemPrices = event.data.object.items?.data ?? []

  return [...inlineLinePrices, ...itemPrices]
    .map((entry) => entry.price?.id ?? null)
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

export function projectLicenseFromStripeEvent(
  event: StripeEventShape,
  priceIdToPlan: Record<string, LicensePlan>,
  now = Date.now(),
): LicenseProjection {
  const email =
    event.data.object.metadata?.email ??
    event.data.object.customer_email ??
    null

  if (!email) {
    throw new Error('Stripe event is missing email')
  }

  const priceIds = collectPriceIds(event)
  const plan = derivePlanFromPriceIds(priceIdToPlan, priceIds)

  return {
    email: email.toLowerCase().trim(),
    plan,
    eventId: event.id,
    record: projectLicenseRecord(plan, now, 'stripe'),
  }
}
