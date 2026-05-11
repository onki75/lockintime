import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import {
  createTestSettings,
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Locations', () => {
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

  async function openLocationsTab(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    const page = await openOptionsPage(context, extensionId)
    await page.getByRole('button', { name: /場所の管理/ }).click()
    await page.waitForSelector('text=位置情報制限', { timeout: 10_000 })
    return page
  }

  function visibleDialog(page: Page): Locator {
    return page.locator('div.pointer-events-auto > [role="dialog"]')
  }

  test('shows the location section', async () => {
    const page = await openLocationsTab()
    await expect(page.getByText('位置情報制限', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the three location action buttons', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByRole('button', { name: /現在地を更新/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /現在地を保存/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /手動追加/ })).toBeVisible()
    await page.close()
  })

  test('shows the empty state when no locations are saved', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText('まだ場所が登録されていません。', { exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the manual add dialog', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /手動追加/ }).click()
    await expect(visibleDialog(page).getByText('場所を追加（手動入力）', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows four inputs in the manual location dialog', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /手動追加/ }).click()
    await expect(visibleDialog(page).locator('input')).toHaveCount(4)
    await page.close()
  })

  test('disables save in the manual dialog while fields are empty', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    await page.getByRole('button', { name: /手動追加/ }).click()
    await expect(visibleDialog(page).getByRole('button', { name: '追加', exact: true })).toBeDisabled()
    await page.close()
  })

  test('validates latitude ranges', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    const dialog = visibleDialog(page)
    await page.getByRole('button', { name: /手動追加/ }).click()
    await dialog.locator('input[type="number"]').nth(0).fill('91')
    await expect(dialog.getByText('緯度は-90から90の範囲で入力してください。', { exact: true })).toBeVisible()
    await page.close()
  })

  test('validates longitude ranges', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    const dialog = visibleDialog(page)
    await page.getByRole('button', { name: /手動追加/ }).click()
    await dialog.locator('input[type="number"]').nth(1).fill('181')
    await expect(dialog.getByText('経度は-180から180の範囲で入力してください。', { exact: true })).toBeVisible()
    await page.close()
  })

  test('closes the manual dialog when cancel is clicked', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
    })
    const dialog = visibleDialog(page)
    await page.getByRole('button', { name: /手動追加/ }).click()
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.close()
  })

  test('shows existing saved locations', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        locations: [
          {
            id: 'office',
            name: '職場',
            latitude: 35.6812,
            longitude: 139.7671,
            radiusMeters: 100,
          },
        ],
      }),
    })
    await page.waitForSelector('text=職場', { timeout: 10_000 })
    await expect(page.getByText('職場', { exact: true })).toBeVisible()
    await page.close()
  })

  test('removes a location when delete is clicked', async () => {
    const page = await openLocationsTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        locations: [
          {
            id: 'office',
            name: '職場',
            latitude: 35.6812,
            longitude: 139.7671,
            radiusMeters: 100,
          },
        ],
      }),
    })
    await page.waitForSelector('text=職場', { timeout: 10_000 })
    // Find the trash button - it's the only standalone button with an svg inside the location list area
    const trashButtons = page.locator('main button:has(svg.h-4.w-4)')
    await trashButtons.first().click()
    await page.waitForTimeout(1000)
    await expect(page.getByText('まだ場所が登録されていません')).toBeVisible()
    await page.close()
  })
})
