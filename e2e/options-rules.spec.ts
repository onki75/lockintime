import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import {
  createTestGroupRule,
  createTestSettings,
  createTestSiteRule,
  createTestStorageData,
  getExtensionId,
  launchBrowserWithExtension,
  openOptionsPage,
  setStorage,
  skipOnboarding,
} from './helpers'

test.describe('Options Rules', () => {
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

  async function openRulesTab(overrides: Record<string, unknown> = {}): Promise<Page> {
    await skipOnboarding(context, extensionId)
    await setStorage(context, extensionId, createTestStorageData(overrides))

    return openOptionsPage(context, extensionId)
  }

  function siteRow(page: Page, url: string): Locator {
    return page.locator('div').filter({
      has: page.getByText(url, { exact: true }),
    }).first()
  }

  function groupRow(page: Page, name: string): Locator {
    return page.locator('div').filter({
      has: page.getByText(new RegExp(`^${name}`)),
    }).first()
  }

  function visibleDialog(page: Page): Locator {
    return page.locator('div.pointer-events-auto > [role="dialog"]')
  }

  const timeOfDayRule = createTestSiteRule({
    id: 'time-rule',
    url: 'reddit.com',
    restrictions: [{
      type: 'time_of_day',
      schedule: [{ days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' }],
    }],
  })

  test('shows the empty state when there are no rules', async () => {
    const page = await openRulesTab()
    await expect(page.getByText('ブロックするサイトがありません', { exact: true })).toBeVisible()
    await page.close()
  })

  test('adds a site rule through the full flow', async () => {
    const page = await openRulesTab()
    await page.getByRole('button', { name: /サイトを追加/ }).click()
    await page.waitForSelector('[role="dialog"] input', { timeout: 10_000 })
    await page.locator('[role="dialog"] input').fill('reddit.com')
    await page.locator('[role="dialog"]').getByRole('button', { name: '追加', exact: true }).click()
    await page.waitForSelector('text=reddit.com', { timeout: 10_000 })
    await expect(page.locator('main').getByText('reddit.com').first()).toBeVisible()
    await page.close()
  })

  test('prevents adding duplicate site rules', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
    })
    await page.getByRole('button', { name: /サイトを追加/ }).click()
    const dialog = visibleDialog(page)
    await dialog.getByPlaceholder('例: youtube.com').fill('youtube.com')
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    await expect(dialog.getByText('このサイトは既に追加されています', { exact: true })).toBeVisible()
    await page.close()
  })

  test('does not show a toggle in the rule detail screen', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
    })
    await siteRow(page, 'youtube.com').click()
    await expect(page.getByRole('switch')).toHaveCount(0)
    await page.close()
  })

  test('renders a group row with its domains', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [createTestGroupRule()],
      }),
    })
    await page.waitForSelector('text=SNS', { timeout: 10_000 })
    await expect(page.getByText(/SNS.*2サイト/).first()).toBeVisible()
    await expect(page.getByText(/x\.com.*instagram\.com/).first()).toBeVisible()
    await page.close()
  })

  test('opens the restriction popover from a badge click', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [timeOfDayRule],
      }),
    })
    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await expect(page.getByText('時間帯制限', { exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the time-of-day editor from the popover', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [timeOfDayRule],
      }),
    })
    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await page.getByRole('button', { name: '編集', exact: true }).click()
    await expect(page.getByText('時間帯制限を編集', { exact: true })).toBeVisible()
    await page.close()
  })

  test('keeps the original schedule when edit is cancelled', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [timeOfDayRule],
      }),
    })
    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await page.getByRole('button', { name: '編集', exact: true }).click()
    const dialog = visibleDialog(page)
    await dialog.getByRole('button', { name: '休日', exact: true }).click()
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await expect(page.getByText('平日（月〜金） 9:00〜18:00', { exact: true })).toBeVisible()
    await page.close()
  })

  test('saves custom time-of-day changes', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [timeOfDayRule],
      }),
    })
    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await page.getByRole('button', { name: '編集', exact: true }).click()
    await page.getByRole('button', { name: 'カスタム', exact: true }).click()
    await page.getByRole('button', { name: '土', exact: true }).click()
    await page.getByRole('button', { name: '日', exact: true }).click()
    await page.locator('input[type="time"]').nth(0).fill('10:00')
    await page.locator('input[type="time"]').nth(1).fill('20:00')
    await page.getByRole('button', { name: '保存', exact: true }).click()

    await siteRow(page, 'reddit.com').getByRole('button', { name: 'Time of day', exact: true }).click()
    await expect(page.getByText('休日（土・日） 10:00〜20:00', { exact: true })).toBeVisible()
    await page.close()
  })

  test('allows adding a sixth stored rule on the free plan', async () => {
    const rules = Array.from({ length: 5 }, (_, index) => createTestSiteRule({
      id: `rule-${index + 1}`,
      url: `site${index + 1}.com`,
    }))

    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: rules,
      }),
    })
    await page.getByRole('button', { name: /サイトを追加/ }).click()
    const dialog = visibleDialog(page)
    await dialog.getByPlaceholder('例: youtube.com').fill('site6.com')
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    await expect(page.getByText('site6.com', { exact: true })).toBeVisible()
    await page.close()
  })

  test('opens the create group dialog during trial', async () => {
    const page = await openRulesTab({
      trialStartDate: Date.now(),
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
    })
    await page.getByRole('button', { name: 'グループを作成', exact: true }).click()
    await expect(visibleDialog(page).getByText('グループを作成', { exact: true })).toBeVisible()
    await page.close()
  })

  test('disables add in the site dialog while the url is empty', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
    })
    await page.getByRole('button', { name: /サイトを追加/ }).click()
    const dialog = visibleDialog(page)
    await expect(dialog.getByRole('button', { name: '追加', exact: true })).toBeDisabled()
    await page.close()
  })

  test('shows all restriction types while Pro plan is disabled', async () => {
    const page = await openRulesTab({
      settings: createTestSettings({
        blockRules: [createTestSiteRule()],
      }),
    })
    await page.getByRole('button', { name: /サイトを追加/ }).click()
    const dialog = visibleDialog(page)
    await expect(dialog.getByText('使用回数制限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('使用時間制限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('クールダウン', { exact: true })).toBeVisible()
    await expect(dialog.getByText('遅延アクセス', { exact: true })).toBeVisible()
    await page.close()
  })
})
