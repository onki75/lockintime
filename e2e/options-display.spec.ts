import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestSettings,
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Display', () => {
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

  async function openDisplayTab(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    const page = await openOptionsPage(context, extensionId)
    await page.getByRole('button', { name: /^表示設定/ }).click()
    await page.locator('main').getByText('表示設定', { exact: true }).first().waitFor()
    return page
  }

  test('shows the display settings section', async () => {
    const page = await openDisplayTab()
    await expect(page.locator('main').getByText('表示設定', { exact: true })).toBeVisible()
    await page.close()
  })

  test('switches streak display to heatmap', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
    })
    const heatmapButton = page.getByRole('button', { name: /ヒートマップ/ })
    await heatmapButton.click()
    await expect(heatmapButton).toHaveAttribute('aria-pressed', 'true')
    await page.close()
  })

  test('switches streak display to number', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        streakDisplayMode: 'heatmap',
      }),
    })
    const numberButton = page.getByRole('button', { name: /数字/ })
    await numberButton.click()
    await expect(numberButton).toHaveAttribute('aria-pressed', 'true')
    await page.close()
  })

  test('shows the empty custom quotes state', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText('まだカスタム名言はありません。', { exact: true })).toBeVisible()
    await page.close()
  })

  test('disables add while the quote input is empty', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
    })
    await expect(page.getByRole('button', { name: /追加/ }).last()).toBeDisabled()
    await page.close()
  })

  test('adds a custom quote with the add button', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
    })
    await page.locator('input[type="text"]').fill('今日はやる')
    await page.getByRole('button', { name: /追加/ }).last().click()
    await expect(page.getByText('今日はやる', { exact: true })).toBeVisible()
    await page.close()
  })

  test('adds a custom quote when pressing Enter', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
    })
    await page.locator('input[type="text"]').fill('次の5分に集中')
    await page.locator('input[type="text"]').press('Enter')
    await expect(page.getByText('次の5分に集中', { exact: true })).toBeVisible()
    await page.close()
  })

  test('deletes a custom quote', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        customQuotes: [
          {
            id: 'quote-1',
            content: '消す名言',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }),
    })
    await page.getByRole('button', { name: '名言を削除', exact: true }).click()
    await expect(page.getByText('消す名言', { exact: true })).toHaveCount(0)
    await page.close()
  })

  test('shows existing custom quotes', async () => {
    const page = await openDisplayTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        customQuotes: [
          {
            id: 'quote-1',
            content: '継続は力なり',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }),
    })
    await expect(page.getByText('継続は力なり', { exact: true })).toBeVisible()
    await page.close()
  })
})
