import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Sidebar', () => {
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

  async function openOptions(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    return openOptionsPage(context, extensionId)
  }

  test('shows LockInTime branding', async () => {
    const page = await openOptions()
    await expect(page.getByText('LockInTime', { exact: true })).toBeVisible()
    await page.close()
  })

  test('switches content when a different tab is clicked', async () => {
    const page = await openOptions()
    await page.getByRole('button', { name: 'データ管理', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'データ管理', exact: true })).toBeVisible()
    await page.close()
  })

  test('shows all primary tabs without Pro lock markers', async () => {
    const page = await openOptions()
    await expect(page.getByRole('button', { name: /ロックモード/ })).not.toContainText('🔒')
    await expect(page.getByRole('button', { name: /場所の管理/ })).not.toContainText('🔒')
    await expect(page.getByRole('button', { name: /表示設定/ })).not.toContainText('🔒')
    await page.close()
  })

  test('highlights the active tab', async () => {
    const page = await openOptions()
    const activeButton = page.getByRole('button', { name: 'ブロックリスト', exact: true })
    await expect(activeButton).toHaveClass(/bg-blue-50/)
    await page.close()
  })
})
