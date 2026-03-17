const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted'

type OnboardingStorageShape = {
  onboardingCompleted?: boolean
}

export async function shouldShowOnboarding(): Promise<boolean> {
  const result = (await chrome.storage.local.get(
    ONBOARDING_COMPLETED_KEY,
  )) as OnboardingStorageShape

  return result.onboardingCompleted !== true
}

export async function completeOnboarding(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_COMPLETED_KEY]: true,
  })
}

export async function resetOnboarding(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_COMPLETED_KEY]: false,
  })
}

export function getOnboardingUrl(): string {
  return chrome.runtime.getURL('options.html?onboarding=true')
}
