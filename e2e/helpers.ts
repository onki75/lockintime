import { type BrowserContext, type Page, chromium } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_AUTH_STATE,
  DEFAULT_BYPASS_STATE,
  DEFAULT_COOLDOWN_STATE,
  DEFAULT_DELETED_MAP,
  DEFAULT_LICENSE_CACHE,
  DEFAULT_LOCATION_STATE,
  DEFAULT_LOCK_MODE,
  DEFAULT_MASCOT_STATE,
  DEFAULT_RESCUE_PASS,
  DEFAULT_SETTINGS,
  DEFAULT_STREAK_DATA,
  DEFAULT_SYNC_STATE,
} from '../src/lib/defaults'
import { getDefaultFreeActiveRuleIds } from '../src/lib/rule-activation'
import type {
  GroupRule,
  Settings,
  SiteRule,
} from '../src/lib/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = resolve(__dirname, '..', 'dist')
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function launchBrowserWithExtension(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  })

  let sw = context.serviceWorkers()[0]
  if (!sw) {
    sw = await context.waitForEvent('serviceworker')
  }

  return context
}

export function getExtensionId(context: BrowserContext): string {
  const sw = context.serviceWorkers()[0]
  if (!sw) {
    throw new Error('No service worker found — extension may not have loaded')
  }
  return new URL(sw.url()).hostname
}

export function getPopupUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/popup.html`
}

export function getOptionsUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/options.html`
}

export function getBlockedUrl(extensionId: string, query = ''): string {
  return `chrome-extension://${extensionId}/blocked.html${query}`
}

export async function setStorage(
  context: BrowserContext,
  extensionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const page = await context.newPage()
  await page.goto(getBlockedUrl(extensionId), { waitUntil: 'domcontentloaded' })
  await page.evaluate(async (d) => chrome.storage.local.set(d), data)
  await page.close()
}

export async function getStorage<T = Record<string, unknown>>(
  context: BrowserContext,
  extensionId: string,
  keys?: string | string[],
): Promise<T> {
  const page = await context.newPage()
  await page.goto(getBlockedUrl(extensionId), { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async (k) => chrome.storage.local.get(k), keys)
  await page.close()
  return result as T
}

export async function skipOnboarding(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  await setStorage(context, extensionId, { onboardingCompleted: true })
}

export async function closeExtensionPages(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  await Promise.all(
    context
      .pages()
      .filter((page) => !page.isClosed())
      .filter((page) => page.url().startsWith(`chrome-extension://${extensionId}/`))
      .map((page) => page.close().catch(() => undefined)),
  )
}

export async function openOptionsPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  await closeExtensionPages(context, extensionId)

  const page = await context.newPage()
  await page.goto(getOptionsUrl(extensionId), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('text=ブロックリスト', { timeout: 10_000 })
  return page
}

export function createTestSiteRule(overrides: Partial<SiteRule> = {}): SiteRule {
  const now = Date.now()
  return {
    id: 'test-rule-1',
    type: 'site',
    url: 'youtube.com',
    restrictions: [{ type: 'full_block' }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createTestGroupRule(overrides: Partial<GroupRule> = {}): GroupRule {
  const now = Date.now()
  return {
    id: 'test-group-1',
    type: 'group',
    name: 'SNS',
    urls: ['x.com', 'instagram.com'],
    restrictions: [{ type: 'full_block' }],
    preset: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createTestSettings(overrides: Partial<Settings> = {}): Settings {
  const now = Date.now()
  const base = {
    ...structuredClone(DEFAULT_SETTINGS),
    updatedAt: now,
    ...overrides,
  }

  return {
    ...base,
    freeActiveRuleIds: overrides.freeActiveRuleIds
      ?? getDefaultFreeActiveRuleIds(base.blockRules),
    lockMode: {
      ...structuredClone(DEFAULT_LOCK_MODE),
      updatedAt: now,
      ...(overrides.lockMode ?? {}),
    },
  }
}

export function createTestStorageData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authState: structuredClone(DEFAULT_AUTH_STATE),
    bypassState: structuredClone(DEFAULT_BYPASS_STATE),
    cooldownState: structuredClone(DEFAULT_COOLDOWN_STATE),
    dailyStats: null,
    dailyStatsHistory: {},
    deletedMap: structuredClone(DEFAULT_DELETED_MAP),
    licenseCache: structuredClone(DEFAULT_LICENSE_CACHE),
    locationState: structuredClone(DEFAULT_LOCATION_STATE),
    mascotState: structuredClone(DEFAULT_MASCOT_STATE),
    onboardingCompleted: true,
    rescuePass: structuredClone(DEFAULT_RESCUE_PASS),
    settings: createTestSettings(),
    streakData: structuredClone(DEFAULT_STREAK_DATA),
    syncState: structuredClone(DEFAULT_SYNC_STATE),
    trialDowngradeDialogShown: false,
    trialStartDate: Date.now() - 30 * ONE_DAY_MS,
    ...overrides,
  }
}

export async function seedTrialActive(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  await setStorage(context, extensionId, { trialStartDate: Date.now() })
}

export async function seedFreePlan(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  await setStorage(context, extensionId, { trialStartDate: Date.now() - 30 * ONE_DAY_MS })
}
