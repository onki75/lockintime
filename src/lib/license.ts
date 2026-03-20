import { getLicenseCache, saveLicenseCache } from './storage'
import type { LicenseCache, LicensePlan } from './types'

export const LICENSE_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

export function resolveEffectiveLicensePlan(
  cache: LicenseCache,
  now = Date.now(),
): LicensePlan {
  if (cache.plan === 'free') {
    return 'free'
  }

  if (cache.lastVerified === null) {
    return 'free'
  }

  return now - cache.lastVerified <= LICENSE_GRACE_PERIOD_MS ? cache.plan : 'free'
}

export async function getEffectiveLicensePlan(
  now = Date.now(),
): Promise<LicensePlan> {
  const cache = await getLicenseCache()
  return resolveEffectiveLicensePlan(cache, now)
}

export async function refreshLicenseCache(
  plan: LicensePlan,
  verifiedAt = Date.now(),
  email: string | null = null,
): Promise<LicenseCache> {
  const existing = await getLicenseCache()
  const cache: LicenseCache = {
    plan,
    lastVerified: verifiedAt,
    source: 'cloud',
    expiresAt: null,
    email: email ?? existing.email,
  }

  await saveLicenseCache(cache)
  return cache
}

export async function hasProAccess(now = Date.now()): Promise<boolean> {
  const plan = await getEffectiveLicensePlan(now)
  return plan === 'pro' || plan === 'cloud'
}

export async function hasCloudSyncAccess(now = Date.now()): Promise<boolean> {
  return (await getEffectiveLicensePlan(now)) === 'cloud'
}

function getVerifyLicenseUrl(): string | null {
  return (
    globalThis.__LOCKINTIME_ENV__?.VITE_VERIFY_LICENSE_URL ??
    import.meta.env.VITE_VERIFY_LICENSE_URL ??
    null
  )
}

declare global {
  var __LOCKINTIME_ENV__: Record<string, string | undefined> | undefined
}

export async function verifyLicenseByEmail(email: string): Promise<LicensePlan> {
  const endpoint = getVerifyLicenseUrl()
  if (!endpoint) {
    throw new Error('License verification endpoint is not configured')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error(`License verification failed: ${response.status}`)
  }

  const data = (await response.json()) as { plan?: LicensePlan }
  return data.plan ?? 'free'
}

export async function verifyAndCacheLicense(email: string): Promise<LicenseCache> {
  const plan = await verifyLicenseByEmail(email)
  return refreshLicenseCache(plan, Date.now(), email)
}
