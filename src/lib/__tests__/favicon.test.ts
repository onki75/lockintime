import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getChromeFaviconUrl } from '../favicon'

const getURL = vi.fn((path: string) => `chrome-extension://test-id/${path}`)

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { getURL },
  })
  getURL.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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
