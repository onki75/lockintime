// Chrome Storage wrapper

export interface BlockRule {
  id: string
  url: string
  enabled: boolean
}

export interface Settings {
  blockRules: BlockRule[]
  focusMode: boolean
  focusDuration: number // minutes
}

const DEFAULT_SETTINGS: Settings = {
  blockRules: [],
  focusMode: false,
  focusDuration: 25,
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings') as { settings?: Settings }
  return result.settings ?? DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}
