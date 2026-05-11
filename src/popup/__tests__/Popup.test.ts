import { describe, expect, it } from 'vitest'
import { getHostnameFromUrl, getRulesMatchingHostname } from '../Popup'
import type { BlockRule } from '../../lib/types'

describe('getHostnameFromUrl', () => {
  it('normalizes web URLs and ignores extension pages', () => {
    expect(getHostnameFromUrl('https://www.youtube.com/watch?v=1')).toBe('youtube.com')
    expect(getHostnameFromUrl('chrome://extensions')).toBeNull()
    expect(getHostnameFromUrl(undefined)).toBeNull()
  })
})

describe('getRulesMatchingHostname', () => {
  const rules: BlockRule[] = [
    {
      id: 'youtube-rule',
      type: 'site',
      url: 'youtube.com',
      restrictions: [{ type: 'full_block' }],
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'sns-group',
      type: 'group',
      name: 'SNS',
      urls: ['twitter.com', 'x.com'],
      restrictions: [{ type: 'full_block' }],
      preset: true,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'news-rule',
      type: 'site',
      url: 'news.example.com',
      restrictions: [{ type: 'full_block' }],
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  it('returns only active rules that match the current hostname', () => {
    expect(getRulesMatchingHostname(rules, 'mobile.twitter.com').map((rule) => rule.id)).toEqual([
      'sns-group',
    ])
  })

  it('does not return all rules when the current hostname is unavailable', () => {
    expect(getRulesMatchingHostname(rules, null)).toEqual([])
  })
})
