import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  createTestStorageData,
  getExtensionId,
  getOptionsUrl,
  getStorage,
  launchBrowserWithExtension,
  setStorage,
} from './helpers'

test.describe('Onboarding', () => {
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

  async function openOnboarding(
    overrides: Record<string, unknown> = {},
    query = '',
  ): Promise<Page> {
    await setStorage(context, extensionId, createTestStorageData({
      onboardingCompleted: false,
      ...overrides,
    }))

    const page = await context.newPage()
    await page.goto(`${getOptionsUrl(extensionId)}${query}`)
    await page.waitForSelector('text=3ステップで初期設定を完了します', { timeout: 10_000 })
    return page
  }

  async function goToStep2(page: Page) {
    await page.getByRole('button', { name: /仕事に集中/ }).click()
    await page.getByRole('button', { name: /次へ/ }).click()
    await page.waitForSelector('text=「仕事ならこのサイトをブロックしよう！」', { timeout: 10_000 })
  }

  test('shows all four goal buttons', async () => {
    const page = await openOnboarding()
    await expect(page.getByRole('button', { name: /仕事に集中/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /勉強に集中/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /SNS断ち/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /健康的な生活/ })).toBeVisible()
    await page.close()
  })

  test('keeps next disabled before a goal is selected', async () => {
    const page = await openOnboarding()
    await expect(page.getByRole('button', { name: /次へ/ })).toBeDisabled()
    await page.close()
  })

  test('enables next after selecting a goal', async () => {
    const page = await openOnboarding()
    await page.getByRole('button', { name: /仕事に集中/ }).click()
    await expect(page.getByRole('button', { name: /次へ/ })).toBeEnabled()
    await page.close()
  })

  test('transitions from step 1 to step 2', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await expect(page.getByText('「仕事ならこのサイトをブロックしよう！」', { exact: true })).toBeVisible()
    await page.close()
  })

  test('preselects suggested site checkboxes on step 2', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await expect(page.locator('label').filter({ hasText: 'youtube.com' }).locator('input')).toBeChecked()
    await expect(page.locator('label').filter({ hasText: 'x.com' }).locator('input')).toBeChecked()
    await page.close()
  })

  test('allows turning off a selected site', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    const youtubeCheckbox = page.locator('label').filter({ hasText: 'youtube.com' }).locator('input')
    await youtubeCheckbox.uncheck({ force: true })
    await expect(youtubeCheckbox).not.toBeChecked()
    await page.close()
  })

  test('returns to step 1 from step 2', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await page.getByRole('button', { name: /戻る/ }).click()
    await page.waitForSelector('text=Goal', { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /次へ/ })).toBeEnabled()
    await page.close()
  })

  test('disables start blocking when all sites are unchecked', async () => {
    const page = await openOnboarding()
    await goToStep2(page)

    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    for (let index = 0; index < checkboxCount; index += 1) {
      await checkboxes.nth(index).uncheck({ force: true })
    }

    await expect(page.getByRole('button', { name: 'ブロック開始→', exact: true })).toBeDisabled()
    await page.close()
  })

  test('keeps start blocking enabled with at least one selected site', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await expect(page.getByRole('button', { name: 'ブロック開始→', exact: true })).toBeEnabled()
    await page.close()
  })

  test('reaches step 3 after starting blocking', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await page.getByRole('button', { name: 'ブロック開始→', exact: true }).click()
    await page.waitForSelector('text=準備完了！', { timeout: 10_000 })
    await expect(page.getByText('準備完了！', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the completion message on step 3', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await page.getByRole('button', { name: 'ブロック開始→', exact: true }).click()
    await page.waitForSelector('text=サイトのブロックを開始しました', { timeout: 10_000 })
    await expect(page.getByText(/サイトのブロックを開始しました/)).toBeVisible()
    await page.close()
  })

  test('shows the settings page button on step 3', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await page.getByRole('button', { name: 'ブロック開始→', exact: true }).click()
    await page.waitForSelector('text=設定ページを開く', { timeout: 10_000 })
    await expect(page.getByRole('button', { name: '設定ページを開く', exact: true })).toBeVisible()
    await page.close()
  })

  test('stores onboarding completion and trial start after finishing', async () => {
    const page = await openOnboarding()
    await goToStep2(page)
    await page.getByRole('button', { name: 'ブロック開始→', exact: true }).click()

    await expect.poll(async () => {
      const storage = await getStorage<{
        onboardingCompleted?: boolean
        trialStartDate?: number
      }>(context, extensionId, ['onboardingCompleted', 'trialStartDate'])

      return storage.onboardingCompleted === true && typeof storage.trialStartDate === 'number'
    }).toBe(true)

    await page.close()
  })

  test('forces onboarding with the query parameter even when onboarding is completed', async () => {
    await setStorage(context, extensionId, createTestStorageData({
      onboardingCompleted: true,
    }))

    const page = await context.newPage()
    await page.goto(`${getOptionsUrl(extensionId)}?onboarding=true`)
    await page.waitForSelector('text=3ステップで初期設定を完了します', { timeout: 10_000 })
    await expect(page.getByText('3ステップで初期設定を完了します', { exact: true })).toBeVisible()
    await page.close()
  })
})
