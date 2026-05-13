import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetFaviconCacheForTests,
  getChromeFaviconUrl,
  isChromeFaviconKnown,
} from '../favicon'

const getURL = vi.fn((path: string) => `chrome-extension://test-id/${path}`)

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { getURL },
  })
  getURL.mockClear()
  __resetFaviconCacheForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeResponse(bytes: number[]): Response {
  return new Response(new Uint8Array(bytes))
}

describe('getChromeFaviconUrl', () => {
  it('builds an extension-relative URL via chrome.runtime.getURL', () => {
    const url = getChromeFaviconUrl('youtube.com', 32)
    expect(url).toBe(
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com&size=32',
    )
  })

  it('strips https:// when the caller passes a full URL', () => {
    expect(getChromeFaviconUrl('https://www.instagram.com', 16)).toBe(
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Finstagram.com&size=16',
    )
  })

  it('strips a leading www. prefix', () => {
    expect(getChromeFaviconUrl('www.x.com', 64)).toBe(
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fx.com&size=64',
    )
  })

  it('lowercases the hostname and trims whitespace', () => {
    expect(getChromeFaviconUrl('  YouTube.COM  ', 32)).toBe(
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com&size=32',
    )
  })

  it('returns null when the domain is empty after normalization', () => {
    expect(getChromeFaviconUrl('', 32)).toBeNull()
    expect(getChromeFaviconUrl('   ', 32)).toBeNull()
    expect(getChromeFaviconUrl('https://', 32)).toBeNull()
  })

  it('returns null when chrome.runtime is unavailable', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('chrome', {})
    expect(getChromeFaviconUrl('youtube.com', 32)).toBeNull()
  })
})

describe('isChromeFaviconKnown', () => {
  it('returns false when chrome.runtime is unavailable', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('chrome', {})
    const fetcher = vi.fn()
    await expect(isChromeFaviconKnown('youtube.com', 32, fetcher)).resolves.toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns true when the favicon bytes differ from the sentinel', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('youtube.com')) return makeResponse([1, 2, 3, 4])
      return makeResponse([9, 9, 9, 9])
    })

    await expect(isChromeFaviconKnown('youtube.com', 32, fetcher)).resolves.toBe(true)
  })

  it('returns false when the favicon bytes match the sentinel (default globe)', async () => {
    const sentinelBytes = [9, 9, 9, 9]
    const fetcher = vi.fn(async () => makeResponse(sentinelBytes))

    await expect(isChromeFaviconKnown('youtube.com', 32, fetcher)).resolves.toBe(false)
  })

  it('caches the sentinel fetch across calls', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('youtube.com')) return makeResponse([1, 2, 3])
      if (url.includes('instagram.com')) return makeResponse([4, 5, 6])
      return makeResponse([9, 9, 9])
    })

    await isChromeFaviconKnown('youtube.com', 32, fetcher)
    await isChromeFaviconKnown('instagram.com', 32, fetcher)

    const sentinelCalls = fetcher.mock.calls.filter(
      ([url]) => !String(url).includes('youtube.com') && !String(url).includes('instagram.com'),
    )
    expect(sentinelCalls).toHaveLength(1)
  })

  it('returns false when the fetch throws', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network error')
    })

    await expect(isChromeFaviconKnown('youtube.com', 32, fetcher)).resolves.toBe(false)
  })

  it('returns false when the response is not ok', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }))

    await expect(isChromeFaviconKnown('youtube.com', 32, fetcher)).resolves.toBe(false)
  })
})
