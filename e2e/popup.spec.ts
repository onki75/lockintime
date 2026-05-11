import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import type { StreakRecord } from '../src/lib/types'
import {
  createTestSettings,
  createTestSiteRule,
  createTestStorageData,
  getExtensionId,
  getPopupUrl,
  launchBrowserWithExtension,
  setStorage,
} from './helpers'

test.describe('Popup', () => {
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

  function createStreakRecords(days: number): StreakRecord[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (days - index - 1))
      return {
        date: date.toLocaleDateString('sv-SE'),
        success: true,
        status: 'success',
      }
    })
  }

  async function openPopup(overrides: Record<string, unknown> = {}): Promise<Page> {
    await setStorage(context, extensionId, createTestStorageData({
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
      ...overrides,
    }))

    const page = await context.newPage()
    await page.goto(getPopupUrl(extensionId))
    await page.waitForSelector('text=LockInTime', { timeout: 10_000 })
    return page
  }

  async function openReflectionDialog(page: Page) {
    await page.getByLabel('今日のストリークを確認').click()
    await page.waitForSelector('text=本当にアクセスしますか？', { timeout: 10_000 })
  }

  test('shows the popup header', async () => {
    const page = await openPopup()
    await expect(page.getByText('LockInTime', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the streak calendar', async () => {
    const page = await openPopup()
    await expect(page.getByText(/日連続/)).toBeVisible()
    await page.close()
  })

  test('shows the quick block action', async () => {
    const page = await openPopup()
    await expect(page.getByRole('button', { name: /今のサイトをブロック/ })).toBeVisible()
    await page.close()
  })

  test('popup container has 360px width class', async () => {
    const page = await openPopup()
    await expect(page.locator('.w-\\[360px\\]')).toBeVisible()
    await page.close()
  })

  test('shows the trial badge when the trial is active', async () => {
    const page = await openPopup({
      trialStartDate: Date.now(),
    })
    await expect(page.getByText(/🎉 残り7日/)).toBeVisible()
    await page.close()
  })

  test('hides the trial badge on the free plan', async () => {
    const page = await openPopup()
    await expect(page.getByText(/🎉 残り/)).toHaveCount(0)
    await page.close()
  })

  test('shows the milestone progress bar when a streak exists', async () => {
    const page = await openPopup({
      streakData: {
        perRule: {},
        global: createStreakRecords(5),
        updatedAt: Date.now(),
      },
    })
    await expect(page.getByText('次の目標: 7日', { exact: true })).toBeVisible()
    await expect(page.getByText('5/7日', { exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the reflection dialog when clicking today', async () => {
    const page = await openPopup({
      streakData: {
        perRule: {},
        global: createStreakRecords(3),
        updatedAt: Date.now(),
      },
    })
    await openReflectionDialog(page)
    await expect(page.getByText('本当にアクセスしますか？', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows all three reflection reasons', async () => {
    const page = await openPopup()
    await openReflectionDialog(page)
    await expect(page.getByRole('button', { name: /仕事で必要/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /緊急連絡/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /その他/ })).toBeVisible()
    await page.close()
  })

  test('shows the current streak inside the reflection dialog', async () => {
    const page = await openPopup({
      streakData: {
        perRule: {},
        global: createStreakRecords(3),
        updatedAt: Date.now(),
      },
    })
    await openReflectionDialog(page)
    await expect(page.getByText(/いまのストリークは/)).toBeVisible()
    await expect(page.getByText('3日', { exact: true })).toBeVisible()
    await page.close()
  })

  test('keeps the hold button disabled without a reason', async () => {
    const page = await openPopup()
    await openReflectionDialog(page)
    await expect(page.getByRole('button', { name: '3秒長押しで一時解除', exact: true })).toBeDisabled()
    await page.close()
  })

  test('shows the no-rules message when no enabled rules are available', async () => {
    const page = await openPopup({
      settings: createTestSettings({
        blockRules: [],
      }),
    })
    await openReflectionDialog(page)
    await expect(page.getByText('一時解除できる有効ルールがありません', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '3秒長押しで一時解除', exact: true })).toBeDisabled()
    await page.close()
  })
})
