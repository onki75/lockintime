import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestSiteRule,
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Account', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    context = await launchBrowserWithExtension()
    extensionId = await getExtensionId(context)
  })

  test.afterAll(async () => {
    if (context) {
      await context.close()
    }
  })

  async function openAccountTab(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    const page = await openOptionsPage(context, extensionId)
    await page.getByRole('button', { name: 'プラン・アカウント', exact: true }).click()
    await page.waitForSelector('text=プラン', { timeout: 10_000 })
    return page
  }

  test('shows free plan text', async () => {
    const page = await openAccountTab()
    await expect(page.getByText('Freeプラン', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the rule count for the free plan', async () => {
    const page = await openAccountTab({
      settings: {
        ...createTestStorageData().settings,
        blockRules: [createTestSiteRule()],
      },
    })
    await expect(page.getByText('1 / 5件', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the free plan upgrade button', async () => {
    const page = await openAccountTab()
    await expect(page.getByRole('button', { name: /Proにアップグレード/ })).toBeVisible()
    await page.close()
  })

  test('opens the upgrade dialog from the free plan button', async () => {
    const page = await openAccountTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /Proにアップグレード/ }).click()
    await expect(dialog.getByText('Proプランにアップグレード', { exact: true })).toBeVisible()
    await page.close()
  })

  test('keeps cloud login disabled', async () => {
    const page = await openAccountTab()
    await expect(page.getByRole('button', { name: /Googleアカウントでログイン/ })).toBeDisabled()
    await page.close()
  })

  test('shows the trial plan label when trial is active', async () => {
    const page = await openAccountTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText('Proトライアル中', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the remaining trial days', async () => {
    const page = await openAccountTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText(/残り7日/)).toBeVisible()
    await page.close()
  })

  test('shows the Pro plan button during trial', async () => {
    const page = await openAccountTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByRole('button', { name: 'Proプランを見る', exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the upgrade dialog from the trial CTA', async () => {
    const page = await openAccountTab({
      trialStartDate: Date.now(),
    })
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: 'Proプランを見る', exact: true }).click()
    await expect(dialog.getByText('Proプランにアップグレード', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the feature list inside the upgrade dialog', async () => {
    const page = await openAccountTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /Proにアップグレード/ }).click()
    await expect(dialog.getByText('全7制限タイプ', { exact: true })).toBeVisible()
    await expect(dialog.getByText('ルール無制限', { exact: true })).toBeVisible()
    await page.close()
  })

  test('closes the upgrade dialog with あとで', async () => {
    const page = await openAccountTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /Proにアップグレード/ }).click()
    await dialog.getByRole('button', { name: 'あとで', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.close()
  })

  test('closes the upgrade dialog with アップグレード', async () => {
    const page = await openAccountTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /Proにアップグレード/ }).click()
    await dialog.getByRole('button', { name: 'アップグレード', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.close()
  })
})
