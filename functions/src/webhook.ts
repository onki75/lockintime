import { derivePlanFromPriceIds, projectLicenseRecord, type LicensePlan } from './license'

export type StripeEventShape = {
  id: string
  type: string
  data: {
    object: {
      customer_email?: string | null
      client_reference_id?: string | null
      metadata?: {
        uid?: string
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
  uid: string
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
  const uid =
    event.data.object.metadata?.uid ??
    event.data.object.client_reference_id ??
    null

  if (!uid) {
    throw new Error('Stripe event is missing uid metadata')
  }

  const priceIds = collectPriceIds(event)
  const plan = derivePlanFromPriceIds(priceIdToPlan, priceIds)

  return {
    uid,
    plan,
    eventId: event.id,
    record: projectLicenseRecord(plan, now, 'stripe'),
  }
}
