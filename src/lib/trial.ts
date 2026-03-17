const TRIAL_START_DATE_KEY = 'trialStartDate'
const TRIAL_DURATION_DAYS = 7
const DAY_IN_MS = 24 * 60 * 60 * 1000
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * DAY_IN_MS

type TrialStorage = {
  trialStartDate?: number
}

export async function startTrial(): Promise<void> {
  await chrome.storage.local.set({
    [TRIAL_START_DATE_KEY]: Date.now(),
  })
}

export async function getTrialStartDate(): Promise<number | null> {
  const result = (await chrome.storage.local.get(
    TRIAL_START_DATE_KEY,
  )) as TrialStorage

  return typeof result.trialStartDate === 'number' ? result.trialStartDate : null
}

export async function isTrialActive(): Promise<boolean> {
  const trialStartDate = await getTrialStartDate()

  if (trialStartDate === null) {
    return false
  }

  return Date.now() < trialStartDate + TRIAL_DURATION_MS
}

export async function getTrialDaysRemaining(): Promise<number> {
  const trialStartDate = await getTrialStartDate()

  if (trialStartDate === null) {
    return 0
  }

  const remainingMs = trialStartDate + TRIAL_DURATION_MS - Date.now()

  if (remainingMs <= 0) {
    return 0
  }

  return Math.ceil(remainingMs / DAY_IN_MS)
}
