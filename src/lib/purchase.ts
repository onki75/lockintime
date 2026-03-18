import { isAllowedCheckoutUrl } from './navigation'

export type PurchasePlan = 'pro' | 'cloud'
export type PurchaseInterval = 'monthly' | 'yearly' | 'lifetime'

type CheckoutResponse = {
  url: string
}

type StoredAuthState = {
  status?: 'anonymous' | 'authenticated' | 'error'
  user?: {
    uid: string
    email: string
  } | null
}

type RuntimeEnv = Record<string, string | undefined>

declare global {
  var __LOCKINTIME_ENV__: RuntimeEnv | undefined
}

function getCheckoutFunctionUrl(): string | null {
  return (
    globalThis.__LOCKINTIME_ENV__?.VITE_CHECKOUT_FUNCTION_URL ??
    import.meta.env.VITE_CHECKOUT_FUNCTION_URL ??
    null
  )
}

async function getCheckoutIdentity(): Promise<{ uid: string; email: string }> {
  const result = (await chrome.storage.local.get('authState')) as {
    authState?: StoredAuthState
  }
  const authState = result.authState

  if (authState?.status !== 'authenticated' || !authState.user?.uid || !authState.user.email) {
    throw new Error('Sign in is required before starting checkout')
  }

  return {
    uid: authState.user.uid,
    email: authState.user.email,
  }
}

export async function createCheckoutUrl(
  plan: PurchasePlan,
  interval: PurchaseInterval,
): Promise<string> {
  const endpoint = getCheckoutFunctionUrl()
  if (!endpoint) {
    throw new Error('Checkout endpoint is not configured')
  }
  const identity = await getCheckoutIdentity()

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      uid: identity.uid,
      email: identity.email,
      plan,
      interval,
      successBaseUrl: chrome.runtime.getURL('options.html'),
      cancelBaseUrl: chrome.runtime.getURL('options.html'),
    }),
  })

  if (!response.ok) {
    throw new Error(`Checkout request failed: ${response.status}`)
  }

  const payload = (await response.json()) as Partial<CheckoutResponse>
  if (!payload.url) {
    throw new Error('Checkout response is missing a URL')
  }
  if (!isAllowedCheckoutUrl(payload.url, endpoint)) {
    throw new Error('Checkout response returned an unexpected URL')
  }

  return payload.url
}

export async function startCheckout(
  plan: PurchasePlan,
  interval: PurchaseInterval,
): Promise<string> {
  const url = await createCheckoutUrl(plan, interval)
  await chrome.tabs.create({ url })
  return url
}
