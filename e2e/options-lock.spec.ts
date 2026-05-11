import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Lock', () => {
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

  async function openLockTab(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    const page = await openOptionsPage(context, extensionId)
    await page.getByRole('button', { name: /^ロックモード/ }).click()
    await page.locator('main').getByText('ロックモード', { exact: true }).first().waitFor()
    return page
  }

  test('shows the lock mode section', async () => {
    const page = await openLockTab()
    await expect(page.locator('main').getByRole('heading', { name: 'ロックモード' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /モードを変更/ })).toBeVisible()
    await page.close()
  })

  test('shows the lock mode section during an active trial', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.waitForSelector('text=現在: OFF', { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /モードを変更/ })).toBeVisible()
    await page.close()
  })

  test('shows the current mode label as OFF by default', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText('現在: OFF', { exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the lock mode dialog', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    // Wait for dialog to open - should show OFF button inside dialog
    await page.waitForSelector('text=OFF', { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /OFF/ })).toBeVisible()
    await page.close()
  })

  test('shows all four lock mode options', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    await expect(page.getByRole('button', { name: /OFF/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /パスワード/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /テキストチャレンジ/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nuclear Option/ })).toBeVisible()
    await page.close()
  })

  test('shows the password input when password mode is selected', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    await page.getByRole('button', { name: /パスワード/ }).click()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await page.close()
  })

  test('shows the nuclear duration select when nuclear mode is selected', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    await page.getByRole('button', { name: /Nuclear Option/ }).click()
    await expect(page.locator('select')).toBeVisible()
    await page.close()
  })

  test('disables save without a password in password mode', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    await page.getByRole('button', { name: /パスワード/ }).click()
    await expect(page.getByRole('button', { name: '設定を保存', exact: true })).toBeDisabled()
    await page.close()
  })

  test('keeps the save button visible in the dialog', async () => {
    const page = await openLockTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /モードを変更/ }).click()
    await expect(page.getByRole('button', { name: '設定を保存', exact: true })).toBeVisible()
    await page.close()
  })
})
