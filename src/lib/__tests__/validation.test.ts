import { describe, expect, it } from 'vitest'
import { isGroupRule, isSiteRule, normalizeRulePattern } from '../validation'

describe('normalizeRulePattern', () => {
  it('normalizes domain, url, and wildcard inputs to safe hostnames', () => {
    expect(normalizeRulePattern('WWW.YouTube.com')).toBe('youtube.com')
    expect(normalizeRulePattern('https://x.com/home?tab=1')).toBe('x.com')
    expect(normalizeRulePattern('*.example.com')).toBe('example.com')
    expect(normalizeRulePattern('https://*.example.com/path')).toBe('example.com')
    expect(normalizeRulePattern('localhost:5173')).toBe('localhost')
  })

  it('rejects malformed inputs that would be unsafe DNR filters', () => {
    expect(normalizeRulePattern('example')).toBeNull()
    expect(normalizeRulePattern('evil.com@youtube.com')).toBeNull()
    expect(normalizeRulePattern('youtube.com|http://evil.com')).toBeNull()
    expect(normalizeRulePattern('exa mple.com')).toBeNull()
    expect(normalizeRulePattern('-bad.example')).toBeNull()
  })
})

describe('rule validation', () => {
  it('requires site and group rule urls to be normalizable', () => {
    const base = {
      restrictions: [{ type: 'full_block' }],
      createdAt: 100,
      updatedAt: 200,
    }

    expect(isSiteRule({
      ...base,
      id: 'site-1',
      type: 'site',
      url: 'https://www.youtube.com/watch?v=abc',
    })).toBe(true)
    expect(isSiteRule({
      ...base,
      id: 'site-1',
      type: 'site',
      url: 'youtube.com|http://evil.com',
    })).toBe(false)
    expect(isGroupRule({
      ...base,
      id: 'group-1',
      type: 'group',
      name: 'Group',
      urls: ['*.example.com', 'bad filter^'],
      preset: false,
    })).toBe(false)
  })
})
