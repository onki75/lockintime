import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadPurchaseModule(endpoint?: string) {
  vi.resetModules()
  vi.unstubAllGlobals()
  globalThis.__LOCKINTIME_ENV__ = endpoint
    ? { VITE_CHECKOUT_FUNCTION_URL: endpoint }
    : {}

  const createTabMock = vi.fn(async () => undefined)
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ url: 'https://checkout.stripe.com/c/pay/test-session' }),
  }))

  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    tabs: {
      create: createTabMock,
    },
  })

  return {
    ...(await import('../purchase')),
    createTabMock,
    fetchMock,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCheckoutUrl', () => {
  it('posts to the configured checkout endpoint', async () => {
    const { createCheckoutUrl, fetchMock } = await loadPurchaseModule(
      'https://example.com/checkout',
    )

    await expect(createCheckoutUrl('pro', 'monthly')).resolves.toBe(
      'https://checkout.stripe.com/c/pay/test-session',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/checkout',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('throws when the endpoint is not configured', async () => {
    const { createCheckoutUrl } = await loadPurchaseModule()
    await expect(createCheckoutUrl('pro', 'monthly')).rejects.toThrow(/not configured/i)
  })

  it('rejects unexpected checkout destinations', async () => {
    const { createCheckoutUrl, fetchMock } = await loadPurchaseModule(
      'https://example.com/checkout',
    )
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://evil.example.com/pay' }),
    })

    await expect(createCheckoutUrl('pro', 'monthly')).rejects.toThrow(/unexpected url/i)
  })
})

describe('startCheckout', () => {
  it('opens the returned checkout url in a new tab', async () => {
    const { startCheckout, createTabMock } = await loadPurchaseModule(
      'https://example.com/checkout',
    )

    await startCheckout('cloud', 'yearly')

    expect(createTabMock).toHaveBeenCalledWith({
      url: 'https://checkout.stripe.com/c/pay/test-session',
    })
  })
})
