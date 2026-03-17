import type {
  BlockRule,
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
