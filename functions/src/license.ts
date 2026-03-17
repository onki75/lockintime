export type LicensePlan = 'free' | 'pro' | 'cloud'

export type LicenseRecord = {
  plan: LicensePlan
  lastVerified: number
  updatedAt: number
  updatedBy: string | null
}

export type CleanupCandidate = {
  plan: LicensePlan
  downgradedFromCloudAt: number | null
}

const LICENSE_PRIORITY: Record<LicensePlan, number> = {
  free: 0,
  pro: 1,
  cloud: 2,
}

const CLOUD_DATA_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export function projectLicenseRecord(
  plan: LicensePlan,
  now = Date.now(),
  updatedBy: string | null = 'system',
): LicenseRecord {
  return {
    plan,
    lastVerified: now,
    updatedAt: now,
    updatedBy,
  }
}

export function derivePlanFromPriceIds(
  priceIdToPlan: Record<string, LicensePlan>,
  priceIds: string[],
): LicensePlan {
  let selectedPlan: LicensePlan = 'free'

  for (const priceId of priceIds) {
    const plan = priceIdToPlan[priceId]
    if (!plan) {
      continue
    }

    if (LICENSE_PRIORITY[plan] > LICENSE_PRIORITY[selectedPlan]) {
      selectedPlan = plan
    }
  }

  return selectedPlan
}

export function shouldDeleteCloudData(
  candidate: CleanupCandidate,
  now = Date.now(),
): boolean {
  if (candidate.plan === 'cloud' || candidate.downgradedFromCloudAt === null) {
    return false
  }

  return now - candidate.downgradedFromCloudAt >= CLOUD_DATA_RETENTION_MS
}
