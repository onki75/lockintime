import { describe, expect, it } from 'vitest'
import { projectLicenseFromStripeEvent } from './webhook'

describe('projectLicenseFromStripeEvent', () => {
  it('projects cloud plan updates from a Stripe event', () => {
    expect(
      projectLicenseFromStripeEvent(
        {
          id: 'evt_1',
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                uid: 'user-1',
              },
              lines: {
                data: [
                  {
                    price: {
                      id: 'price_cloud_monthly',
                    },
                  },
                ],
              },
            },
          },
        },
        {
          price_cloud_monthly: 'cloud',
          price_pro_yearly: 'pro',
        },
        1234,
      ),
    ).toEqual({
      uid: 'user-1',
      plan: 'cloud',
      eventId: 'evt_1',
      record: {
        plan: 'cloud',
        lastVerified: 1234,
        updatedAt: 1234,
        updatedBy: 'stripe',
      },
    })
  })

  it('throws when the event cannot be mapped to a user id', () => {
    expect(() =>
      projectLicenseFromStripeEvent(
        {
          id: 'evt_2',
          type: 'checkout.session.completed',
          data: {
            object: {},
          },
        },
        {},
      ),
    ).toThrow(/missing uid/i)
  })
})
