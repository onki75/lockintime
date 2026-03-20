import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Data', () => {
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

  async function openDataTab(): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData())

    const page = await openOptionsPage(context, extensionId)
    await page.getByRole('button', { name: 'データ管理', exact: true }).click()
    await page.waitForSelector('text=データ管理', { timeout: 10_000 })
    return page
  }

  test('shows the export and import buttons', async () => {
    const page = await openDataTab()
    await expect(page.getByRole('button', { name: /エクスポート/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /インポート/ })).toBeVisible()
    await page.close()
  })

  test('shows the setup rerun link', async () => {
    const page = await openDataTab()
    await expect(page.getByRole('button', { name: 'セットアップを再実行', exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the import dialog', async () => {
    const page = await openDataTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /インポート/ }).click()
    await expect(dialog.getByText('設定をインポート', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the file drop area in the import dialog', async () => {
    const page = await openDataTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /インポート/ }).click()
    await expect(dialog.getByText('ファイルを選択またはドロップ', { exact: true })).toBeVisible()
    await page.close()
  })

  test('disables import until a file is selected', async () => {
    const page = await openDataTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /インポート/ }).click()
    await expect(dialog.getByRole('button', { name: 'インポート', exact: true })).toBeDisabled()
    await page.close()
  })

  test('closes the import dialog when cancel is clicked', async () => {
    const page = await openDataTab()
    const dialog = page.locator('[aria-hidden="false"] [role="dialog"]')
    await page.getByRole('button', { name: /インポート/ }).click()
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.close()
  })
})
