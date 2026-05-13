const SENTINEL_DOMAIN = '__lockintime_favicon_sentinel__.invalid'

type Fetcher = typeof fetch

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
}

export function getChromeFaviconUrl(domain: string, size: number): string | null {
  const normalized = normalizeDomain(domain)
  if (!normalized) {
    return null
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    return null
  }

  const pageUrl = `https://${normalized}`
  return chrome.runtime.getURL(
    `_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`,
  )
}

export function getDuckDuckGoFaviconUrl(domain: string): string | null {
  const normalized = normalizeDomain(domain)
  if (!normalized) {
    return null
  }

  return `https://icons.duckduckgo.com/ip3/${normalized}.ico`
}

const sentinelBytesBySize = new Map<number, Promise<ArrayBuffer | null>>()

async function fetchBytes(url: string, fetcher: Fetcher): Promise<ArrayBuffer | null> {
  try {
    const response = await fetcher(url)
    if (!response.ok) {
      return null
    }
    return await response.arrayBuffer()
  } catch {
    return null
  }
}

function bytesEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) {
    return false
  }

  const leftBytes = new Uint8Array(left)
  const rightBytes = new Uint8Array(right)

  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return false
    }
  }

  return true
}

export async function isChromeFaviconKnown(
  domain: string,
  size: number,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  const faviconUrl = getChromeFaviconUrl(domain, size)
  if (!faviconUrl) {
    return false
  }

  const sentinelUrl = getChromeFaviconUrl(SENTINEL_DOMAIN, size)
  if (!sentinelUrl) {
    return false
  }

  let sentinelPromise = sentinelBytesBySize.get(size)
  if (!sentinelPromise) {
    sentinelPromise = fetchBytes(sentinelUrl, fetcher)
    sentinelBytesBySize.set(size, sentinelPromise)
  }

  const [actualBytes, sentinelBytes] = await Promise.all([
    fetchBytes(faviconUrl, fetcher),
    sentinelPromise,
  ])

  if (!actualBytes || !sentinelBytes) {
    return false
  }

  return !bytesEqual(actualBytes, sentinelBytes)
}

export function __resetFaviconCacheForTests(): void {
  sentinelBytesBySize.clear()
}
