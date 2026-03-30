import type {
  BackgroundState,
  BlockRule,
  BypassState,
  CooldownState,
  DailyStats,
  LicenseCache,
  Location,
  LocationState,
  SiteRule,
  RestrictionConfig,
  Settings,
  StreakData,
} from './types'
import {
  DEFAULT_BACKGROUND_STATE,
  DEFAULT_BYPASS_STATE,
  DEFAULT_LICENSE_CACHE,
  DEFAULT_LOCATION_STATE,
  cloneBypassState,
  cloneBackgroundState,
  cloneCooldownState,
  cloneDailyStats,
  cloneLicenseCache,
  cloneLocationState,
  cloneSettings,
  cloneStreakData,
} from './defaults'
import { migrateSettings, migrateStreakData } from './migration'
import {
  isBypassState,
  isDailyStats,
  isLocationState,
} from './validation'

// ===== Settings CRUD =====

export async function getSettings(): Promise<Settings> {
  const result = (await chrome.storage.local.get('settings')) as {
    settings?: unknown
  }
  return migrateSettings(result.settings)
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: cloneSettings(settings) })
}

export async function addLocation(
  name: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Promise<Location> {
  const trimmedName = name.trim()
  const isValidLocation =
    trimmedName.length > 0 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(radiusMeters) &&
    radiusMeters > 0

  if (!isValidLocation) {
    throw new Error('無効な場所データです')
  }

  const settings = await getSettings()
  const now = Date.now()
  const location: Location = {
    id: generateId(),
    name: trimmedName,
    latitude,
    longitude,
    radiusMeters,
    updatedAt: now,
  }

  settings.locations.push(location)
  settings.updatedAt = now
  await saveSettings(settings)
  return location
}

export async function removeLocation(id: string): Promise<void> {
  const settings = await getSettings()
  const now = Date.now()
  settings.locations = settings.locations.filter((location) => location.id !== id)
  settings.updatedAt = now
  await saveSettings(settings)
}

// ===== Background state =====

export async function getBackgroundState(): Promise<BackgroundState> {
  const result = (await chrome.storage.local.get([
    'trialStartDate',
    'dailyStats',
    'dailyStatsHistory',
    'cooldownState',
    'bypassState',
    'locationState',
    'streakData',
    'licenseCache',
  ])) as Partial<BackgroundState>

  const dailyStatsHistory = Object.fromEntries(
    Object.entries(result.dailyStatsHistory ?? {}).filter((entry): entry is [string, DailyStats] => {
      return isDailyStats(entry[1])
    }),
  )

  return {
    trialStartDate: result.trialStartDate,
    dailyStats: result.dailyStats ? cloneDailyStats(result.dailyStats) : null,
    dailyStatsHistory,
    cooldownState: result.cooldownState
      ? cloneCooldownState(result.cooldownState)
      : cloneCooldownState(DEFAULT_BACKGROUND_STATE.cooldownState),
    bypassState: isBypassState(result.bypassState)
      ? cloneBypassState(result.bypassState)
      : cloneBypassState(DEFAULT_BYPASS_STATE),
    locationState: isLocationState(result.locationState)
      ? cloneLocationState(result.locationState)
      : cloneLocationState(DEFAULT_LOCATION_STATE),
    streakData: migrateStreakData(result.streakData),
    licenseCache: result.licenseCache
      ? cloneLicenseCache(result.licenseCache)
      : cloneLicenseCache(DEFAULT_LICENSE_CACHE),
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

export async function saveBypassState(bypassState: BypassState): Promise<void> {
  await chrome.storage.local.set({
    bypassState: cloneBypassState(bypassState),
  })
}

export async function saveLocationState(locationState: LocationState): Promise<void> {
  await chrome.storage.local.set({
    locationState: cloneLocationState(locationState),
  })
}

export async function saveDailyStats(dailyStats: DailyStats): Promise<void> {
  const backgroundState = await getBackgroundState()
  const nextDailyStats = cloneDailyStats(dailyStats)
  await chrome.storage.local.set({
    dailyStats: nextDailyStats,
    dailyStatsHistory: {
      ...backgroundState.dailyStatsHistory,
      [dailyStats.date]: nextDailyStats,
    },
  })
}

export async function resetDailyStats(dailyStats: DailyStats): Promise<void> {
  await saveDailyStats(dailyStats)
}

export async function saveStreakData(streakData: StreakData): Promise<void> {
  await chrome.storage.local.set({ streakData: cloneStreakData(streakData) })
}

export async function getStreakData(): Promise<StreakData> {
  const result = (await chrome.storage.local.get('streakData')) as {
    streakData?: unknown
  }
  return migrateStreakData(result.streakData)
}

export async function saveLicenseCache(licenseCache: LicenseCache): Promise<void> {
  await chrome.storage.local.set({ licenseCache: cloneLicenseCache(licenseCache) })
}

export async function getLicenseCache(): Promise<LicenseCache> {
  const result = (await chrome.storage.local.get('licenseCache')) as {
    licenseCache?: LicenseCache
  }
  return result.licenseCache
    ? cloneLicenseCache(result.licenseCache)
    : cloneLicenseCache(DEFAULT_LICENSE_CACHE)
}

export async function saveBackgroundState(backgroundState: BackgroundState): Promise<void> {
  const nextState = cloneBackgroundState(backgroundState)
  await chrome.storage.local.set({
    trialStartDate: nextState.trialStartDate,
    dailyStats: nextState.dailyStats,
    dailyStatsHistory: nextState.dailyStatsHistory,
    cooldownState: nextState.cooldownState,
    bypassState: nextState.bypassState,
    locationState: nextState.locationState,
    streakData: nextState.streakData,
    licenseCache: nextState.licenseCache,
  })
}

// ===== ルール操作 =====

function generateId(): string {
  return crypto.randomUUID()
}

function normalizeRuleUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return null
  }

  const isValidHostname = (hostname: string): boolean => {
    return hostname === 'localhost' || hostname.includes('.')
  }

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    return isValidHostname(hostname) ? hostname : null
  } catch {
    const hostname = trimmed
      .replace(/^https?:\/\//i, '')
      .split(/[/?#]/, 1)[0]
      .replace(/^www\./i, '')
      .toLowerCase()

    return isValidHostname(hostname) ? hostname : null
  }
}

export type DuplicateCheckResult =
  | { status: 'ok' }
  | { status: 'duplicate_site'; existingRule: SiteRule }
  | { status: 'exists_in_group'; groupName: string }

export async function checkDuplicate(url: string): Promise<DuplicateCheckResult> {
  const settings = await getSettings()
  const normalizedUrl = normalizeRuleUrl(url)

  const existingSiteRule = settings.blockRules.find((rule): rule is SiteRule => {
    return rule.type === 'site' && normalizeRuleUrl(rule.url) === normalizedUrl
  })

  if (existingSiteRule) {
    return { status: 'duplicate_site', existingRule: existingSiteRule }
  }

  const existingGroupRule = settings.blockRules.find((rule) => {
    return rule.type === 'group' && rule.urls.some((entry) => normalizeRuleUrl(entry) === normalizedUrl)
  })

  if (existingGroupRule?.type === 'group') {
    return { status: 'exists_in_group', groupName: existingGroupRule.name }
  }

  return { status: 'ok' }
}

export async function addSiteRule(
  url: string,
  restrictions: RestrictionConfig[],
): Promise<SiteRule> {
  const normalizedUrl = normalizeRuleUrl(url)
  if (normalizedUrl === null) {
    throw new Error('無効なURLです')
  }

  const duplicate = await checkDuplicate(normalizedUrl)
  if (duplicate.status === 'duplicate_site') {
    throw new Error('このサイトは既に追加されています')
  }

  const settings = await getSettings()
  const now = Date.now()
  const rule: SiteRule = {
    id: generateId(),
    type: 'site',
    url: normalizedUrl,
    enabled: true,
    restrictions,
    createdAt: now,
    updatedAt: now,
  }
  settings.blockRules.push(rule)
  settings.updatedAt = now
  await saveSettings(settings)
  return rule
}

export async function removeRule(id: string): Promise<void> {
  const settings = await getSettings()
  const now = Date.now()
  settings.blockRules = settings.blockRules.filter((r) => r.id !== id)
  settings.updatedAt = now
  await saveSettings(settings)
}

export async function toggleRule(id: string): Promise<void> {
  const settings = await getSettings()
  const rule = settings.blockRules.find((r) => r.id === id)
  if (rule) {
    rule.enabled = !rule.enabled
    rule.updatedAt = Date.now()
    settings.updatedAt = rule.updatedAt
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
    const updatedAt = Date.now()
    Object.assign(rule, updates, { updatedAt })
    settings.updatedAt = updatedAt
    await saveSettings(settings)
  }
}

export async function updateSiteRule(
  id: string,
  updates: { url?: string; enabled?: boolean; restrictions?: RestrictionConfig[] },
): Promise<void> {
  const settings = await getSettings()
  const rule = settings.blockRules.find((r) => r.id === id)
  if (!rule || rule.type !== 'site') return

  const updatedAt = Date.now()

  if (updates.url !== undefined) {
    const normalized = normalizeRuleUrl(updates.url)
    if (!normalized) throw new Error('無効なURLです')
    if (normalized !== rule.url) {
      const duplicate = settings.blockRules.find(
        (r) => r.id !== id && (
          (r.type === 'site' && normalizeRuleUrl(r.url) === normalized) ||
          (r.type === 'group' && r.urls.some((u) => normalizeRuleUrl(u) === normalized))
        ),
      )
      if (duplicate) throw new Error('このサイトは既に追加されています')
      rule.url = normalized
    }
  }
  if (updates.enabled !== undefined) rule.enabled = updates.enabled
  if (updates.restrictions !== undefined) rule.restrictions = updates.restrictions
  rule.updatedAt = updatedAt
  settings.updatedAt = updatedAt
  await saveSettings(settings)
}

export async function updateGroupRule(
  id: string,
  updates: { name?: string; urls?: string[]; enabled?: boolean; restrictions?: RestrictionConfig[] },
): Promise<void> {
  const settings = await getSettings()
  const rule = settings.blockRules.find((r) => r.id === id)
  if (!rule || rule.type !== 'group') return

  const updatedAt = Date.now()

  if (updates.name !== undefined) rule.name = updates.name.trim()
  if (updates.urls !== undefined) {
    rule.urls = updates.urls
      .map((u) => normalizeRuleUrl(u))
      .filter((u): u is string => u !== null)
  }
  if (updates.enabled !== undefined) rule.enabled = updates.enabled
  if (updates.restrictions !== undefined) rule.restrictions = updates.restrictions
  rule.updatedAt = updatedAt
  settings.updatedAt = updatedAt
  await saveSettings(settings)
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
