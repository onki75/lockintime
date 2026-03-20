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

  test('shows the rescue pass count', async () => {
    const page = await openPopup({
      rescuePass: {
        available: 2,
        frozenCount: 0,
        frozenMax: 2,
        totalEarned: 2,
        totalUsedBypass: 0,
        totalUsedFreeze: 0,
        totalUsedFeed: 0,
      },
    })
    await expect(page.getByText('🎫 レスキューパス: 2枚', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the mascot section in mascot mode', async () => {
    const page = await openPopup({
      mascotState: {
        level: 1,
        feedCount: 3,
        lastFedAt: Date.now(),
      },
    })
    await expect(page.getByText(/Lv\.1/)).toBeVisible()
    await expect(page.getByText('ひよこ', { exact: true })).toBeVisible()
    await page.close()
  })

  test('hides the mascot section in simple mode', async () => {
    const page = await openPopup({
      settings: createTestSettings({
        uiMode: 'simple',
        blockRules: [createTestSiteRule()],
      }),
    })
    await expect(page.getByText(/Lv\./)).toHaveCount(0)
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

  test('enables the hold button after selecting a reason', async () => {
    const page = await openPopup()
    await openReflectionDialog(page)
    await page.getByRole('button', { name: /仕事で必要/ }).click()
    await expect(page.getByRole('button', { name: '3秒長押しで一時解除', exact: true })).toBeEnabled()
    await page.close()
  })

  test('shows hold progress text while pressing the hold button', async () => {
    const page = await openPopup()
    await openReflectionDialog(page)
    const holdButton = page.getByRole('button', { name: '3秒長押しで一時解除', exact: true })
    await page.getByRole('button', { name: /仕事で必要/ }).click()
    // Use mouse.down on the button's bounding box to trigger onMouseDown
    const box = await holdButton.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await expect(page.getByRole('button', { name: 'そのまま3秒長押しで確定', exact: true })).toBeVisible({ timeout: 3000 })
      await page.mouse.up()
    }
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
