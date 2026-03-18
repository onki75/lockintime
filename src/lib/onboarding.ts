import { addSiteRule, getSettings, saveSettings } from './storage'
import { startTrial } from './trial'
import type { RestrictionConfig, UIMode } from './types'

export const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted'

type OnboardingStorageShape = Partial<
  Record<typeof ONBOARDING_COMPLETED_KEY, boolean>
>

type FinishOnboardingResult = {
  blockedCount: number
  onboardingCompleted: boolean
}

export async function shouldShowOnboarding(): Promise<boolean> {
  const result = (await chrome.storage.local.get(
    ONBOARDING_COMPLETED_KEY,
  )) as OnboardingStorageShape

  return result[ONBOARDING_COMPLETED_KEY] !== true
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

function createDefaultOnboardingRestrictions(): RestrictionConfig[] {
  return [{ type: 'full_block' }]
}

export async function finishOnboarding(
  selectedSites: string[],
  uiMode: UIMode,
): Promise<FinishOnboardingResult> {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    uiMode,
    updatedAt: Date.now(),
  })

  for (const site of selectedSites) {
    await addSiteRule(site, createDefaultOnboardingRestrictions())
  }

  await startTrial()

  try {
    await completeOnboarding()
    return {
      blockedCount: selectedSites.length,
      onboardingCompleted: true,
    }
  } catch {
    return {
      blockedCount: selectedSites.length,
      onboardingCompleted: false,
    }
  }
}
