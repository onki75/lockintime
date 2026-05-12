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
