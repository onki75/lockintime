import { test, expect, type BrowserContext } from '@playwright/test'
import {
  getBlockedUrl,
  getExtensionId,
  launchBrowserWithExtension,
} from './helpers'

test.describe('Blocked Page', () => {
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

  test('shows the blocked site message', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId, '?url=https%3A%2F%2Fyoutube.com'))
    await page.waitForSelector('text=このページはブロックされました', { timeout: 10_000 })
    await expect(page.getByText('このページはブロックされました', { exact: true })).toBeVisible()
    await expect(page.getByText('https://youtube.com', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows a motivational quote', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId))
    await page.waitForSelector('blockquote', { timeout: 10_000 })
    await expect(page.locator('blockquote')).toBeVisible()
    await page.close()
  })

  test('shows the adult filter restriction message', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId, '?filter=adult'))
    await page.waitForSelector('text=成人向けサイトをブロックしました', { timeout: 10_000 })
    await expect(page.getByText('成人向けサイトをブロックしました', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the rule restriction message when a rule id is present', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId, '?url=youtube.com&ruleId=test-rule-1'))
    await page.waitForSelector('text=このサイトはブロック中です', { timeout: 10_000 })
    await expect(page.getByText('このサイトはブロック中です', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows the generic restriction message without filter parameters', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId, '?url=reddit.com'))
    await page.waitForSelector('text=このページはブロックされました', { timeout: 10_000 })
    await expect(page.getByText('このページはブロックされました', { exact: true })).toBeVisible()
    await page.close()
  })

  test('shows unknown site text when the url parameter is missing', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId))
    await page.waitForSelector('text=不明なサイト', { timeout: 10_000 })
    await expect(page.getByText('不明なサイト', { exact: true })).toBeVisible()
    await page.close()
  })

  test('renders the quote in italic style', async () => {
    const page = await context.newPage()
    await page.goto(getBlockedUrl(extensionId))
    await page.waitForSelector('blockquote', { timeout: 10_000 })
    await expect(page.locator('blockquote')).toBeVisible()
    await page.close()
  })
})
