import type {
  AuthState,
  BackgroundState,
  BlockRule,
  BypassState,
  CooldownState,
  DailyStats,
  DeletedMap,
  LicenseCache,
  Location,
  LocationState,
  MascotState,
  RescuePass,
  SiteRule,
  RestrictionConfig,
  Settings,
  StreakData,
  SyncState,
} from './types'
import {
  DEFAULT_AUTH_STATE,
  DEFAULT_BACKGROUND_STATE,
  DEFAULT_BYPASS_STATE,
  DEFAULT_LICENSE_CACHE,
  DEFAULT_DELETED_MAP,
  DEFAULT_LOCATION_STATE,
  DEFAULT_MASCOT_STATE,
  DEFAULT_STREAK_DATA,
  DEFAULT_SYNC_STATE,
  cloneAuthState,
  cloneBypassState,
  cloneBackgroundState,
  cloneCooldownState,
  cloneDailyStats,
  cloneDeletedMap,
  cloneLicenseCache,
  cloneLocationState,
  cloneMascotState,
  cloneRescuePass,
  cloneSettings,
  cloneStreakData,
  cloneSyncState,
} from './defaults'
import { migrateRescuePass, migrateSettings } from './migration'
import {
  isBypassState,
  isDailyStats,
  isDeletedMap,
  isLocationState,
  isMascotState,
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

export async function getRescuePass(): Promise<RescuePass> {
  const result = (await chrome.storage.local.get('rescuePass')) as {
    rescuePass?: unknown
  }

  return migrateRescuePass(result.rescuePass)
}

export async function saveRescuePass(pass: RescuePass): Promise<void> {
  await chrome.storage.local.set({ rescuePass: cloneRescuePass(pass) })
}

export async function getMascotState(): Promise<MascotState> {
  const result = (await chrome.storage.local.get('mascotState')) as {
    mascotState?: unknown
  }

  return isMascotState(result.mascotState)
    ? cloneMascotState(result.mascotState)
    : cloneMascotState(DEFAULT_MASCOT_STATE)
}

export async function saveMascotState(state: MascotState): Promise<void> {
  await chrome.storage.local.set({ mascotState: cloneMascotState(state) })
}

export async function getDeletedMap(): Promise<DeletedMap> {
  const result = (await chrome.storage.local.get('deletedMap')) as {
    deletedMap?: unknown
  }

  return isDeletedMap(result.deletedMap)
    ? cloneDeletedMap(result.deletedMap)
    : cloneDeletedMap(DEFAULT_DELETED_MAP)
}

export async function saveDeletedMap(deletedMap: DeletedMap): Promise<void> {
  await chrome.storage.local.set({ deletedMap: cloneDeletedMap(deletedMap) })
}

async function markDeletedEntry(
  kind: keyof DeletedMap,
  id: string,
  deletedAt = Date.now(),
): Promise<void> {
  const deletedMap = await getDeletedMap()
  deletedMap[kind][id] = deletedAt
  await saveDeletedMap(deletedMap)
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
  const deletedAt = Date.now()
  settings.locations = settings.locations.filter((location) => location.id !== id)
  settings.updatedAt = deletedAt
  await saveSettings(settings)
  await markDeletedEntry('locations', id, deletedAt)
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
    'syncState',
    'authState',
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
    streakData: result.streakData
      ? cloneStreakData(result.streakData)
      : cloneStreakData(DEFAULT_STREAK_DATA),
    syncState: result.syncState
      ? cloneSyncState(result.syncState)
      : cloneSyncState(DEFAULT_SYNC_STATE),
    authState: result.authState
      ? cloneAuthState(result.authState)
      : cloneAuthState(DEFAULT_AUTH_STATE),
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
    streakData?: StreakData
  }
  return result.streakData ? cloneStreakData(result.streakData) : cloneStreakData(DEFAULT_STREAK_DATA)
}

export async function saveSyncState(syncState: SyncState): Promise<void> {
  await chrome.storage.local.set({ syncState: cloneSyncState(syncState) })
}

export async function getSyncState(): Promise<SyncState> {
  const result = (await chrome.storage.local.get('syncState')) as {
    syncState?: SyncState
  }
  return result.syncState ? cloneSyncState(result.syncState) : cloneSyncState(DEFAULT_SYNC_STATE)
}

export async function saveAuthState(authState: AuthState): Promise<void> {
  await chrome.storage.local.set({ authState: cloneAuthState(authState) })
}

export async function getAuthState(): Promise<AuthState> {
  const result = (await chrome.storage.local.get('authState')) as {
    authState?: AuthState
  }
  return result.authState ? cloneAuthState(result.authState) : cloneAuthState(DEFAULT_AUTH_STATE)
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
    syncState: nextState.syncState,
    authState: nextState.authState,
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
  const deletedAt = Date.now()
  settings.blockRules = settings.blockRules.filter((r) => r.id !== id)
  settings.updatedAt = deletedAt
  await saveSettings(settings)
  await markDeletedEntry('blockRules', id, deletedAt)
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
