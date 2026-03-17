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
): Promise<LicenseCache> {
  const cache: LicenseCache = {
    plan,
    lastVerified: verifiedAt,
    source: 'cloud',
    expiresAt: null,
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
