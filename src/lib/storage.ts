import type {
  BackgroundState,
  BlockRule,
  CooldownState,
  DailyStats,
  SiteRule,
  RestrictionConfig,
  Settings,
} from './types'

const DEFAULT_SETTINGS: Settings = {
  blockRules: [],
  adultFilter: false,
  locations: [],
  streakDisplayMode: 'number',
}

function cloneSettings(settings: Settings): Settings {
  return structuredClone(settings)
}

function cloneDailyStats(dailyStats: DailyStats): DailyStats {
  return structuredClone(dailyStats)
}

function cloneCooldownState(cooldownState: CooldownState): CooldownState {
  return structuredClone(cooldownState)
}

const DEFAULT_BACKGROUND_STATE: BackgroundState = {
  dailyStats: null,
  cooldownState: {
    lastAccess: {},
  },
}

// ===== Settings CRUD =====

export async function getSettings(): Promise<Settings> {
  const result = (await chrome.storage.local.get('settings')) as {
    settings?: Settings
  }
  return result.settings ? cloneSettings(result.settings) : cloneSettings(DEFAULT_SETTINGS)
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: cloneSettings(settings) })
}

// ===== Background state =====

export async function getBackgroundState(): Promise<BackgroundState> {
  const result = (await chrome.storage.local.get([
    'trialStartDate',
    'dailyStats',
    'cooldownState',
  ])) as Partial<BackgroundState>

  return {
    trialStartDate: result.trialStartDate,
    dailyStats: result.dailyStats ? cloneDailyStats(result.dailyStats) : null,
    cooldownState: result.cooldownState
      ? cloneCooldownState(result.cooldownState)
      : cloneCooldownState(DEFAULT_BACKGROUND_STATE.cooldownState),
  }
}

export async function setTrialStartDate(trialStartDate: number): Promise<void> {
  await chrome.storage.local.set({ trialStartDate })
}

export async function saveCooldownState(
  cooldownState: CooldownState,
): Promise<void> {
  await chrome.storage.local.set({
    cooldownState: cloneCooldownState(cooldownState),
  })
}

export async function saveDailyStats(dailyStats: DailyStats): Promise<void> {
  await chrome.storage.local.set({ dailyStats: cloneDailyStats(dailyStats) })
}

export async function resetDailyStats(dailyStats: DailyStats): Promise<void> {
  await saveDailyStats(dailyStats)
}

// ===== ルール操作 =====

function generateId(): string {
  return crypto.randomUUID()
}

export async function addSiteRule(
  url: string,
  restrictions: RestrictionConfig[],
): Promise<SiteRule> {
  const settings = await getSettings()
  const now = Date.now()
  const rule: SiteRule = {
    id: generateId(),
    type: 'site',
    url,
    enabled: true,
    restrictions,
    createdAt: now,
    updatedAt: now,
  }
  settings.blockRules.push(rule)
  await saveSettings(settings)
  return rule
}

export async function removeRule(id: string): Promise<void> {
  const settings = await getSettings()
  settings.blockRules = settings.blockRules.filter((r) => r.id !== id)
  await saveSettings(settings)
}

export async function toggleRule(id: string): Promise<void> {
  const settings = await getSettings()
  const rule = settings.blockRules.find((r) => r.id === id)
  if (rule) {
    rule.enabled = !rule.enabled
    rule.updatedAt = Date.now()
    await saveSettings(settings)
  }
}

export async function updateRule(
  id: string,
  updates: Partial<Pick<BlockRule, 'enabled' | 'restrictions'>>,
): Promise<void> {
  const settings = await getSettings()
  const rule = settings.blockRules.find((r) => r.id === id)
  if (rule) {
    Object.assign(rule, updates, { updatedAt: Date.now() })
    await saveSettings(settings)
  }
}

// ===== ユーティリティ =====

/** BlockRuleから全対象ドメインを抽出する */
export function getBlockedDomains(rule: BlockRule): string[] {
  if (rule.type === 'site') return [rule.url]
  return rule.urls
}

/** enabledかつfull_blockの制限を持つルールの全ドメインを返す */
export function getFullBlockDomains(rules: BlockRule[]): string[] {
  return rules
    .filter((r) => r.enabled)
    .filter((r) => r.restrictions.some((res) => res.type === 'full_block'))
    .flatMap(getBlockedDomains)
}

// Re-export types for convenience
export type { Settings, BlockRule, SiteRule } from './types'
