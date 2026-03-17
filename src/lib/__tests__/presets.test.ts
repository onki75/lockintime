import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import {
  presets,
  presetToGroupRule,
  presetToSiteRules,
  type Preset,
} from '../presets'

const NOW = 1_700_000_000_000

describe('presetToSiteRules', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('site-rule-1')
        .mockReturnValueOnce('site-rule-2')
        .mockReturnValueOnce('site-rule-3')
        .mockReturnValueOnce('site-rule-4'),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates site rules for all sites in a preset', () => {
    const preset: Preset = {
      name: 'SNS',
      sites: ['twitter.com', 'x.com'],
    }

    expect(presetToSiteRules(preset)).toEqual([
      {
        id: 'site-rule-1',
        type: 'site',
        url: 'twitter.com',
        enabled: true,
        restrictions: [{ type: 'full_block' }],
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'site-rule-2',
        type: 'site',
        url: 'x.com',
        enabled: true,
        restrictions: [{ type: 'full_block' }],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
  })

  it('filters site rules by selected urls', () => {
    const preset: Preset = {
      name: '動画',
      sites: ['youtube.com', 'twitch.tv', 'abema.tv'],
    }

    expect(presetToSiteRules(preset, ['abema.tv', 'missing.example'])).toEqual([
      {
        id: 'site-rule-1',
        type: 'site',
        url: 'abema.tv',
        enabled: true,
        restrictions: [{ type: 'full_block' }],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
  })
})

describe('presetToGroupRule', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'group-rule-1'),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a preset-backed group rule', () => {
    const preset: Preset = {
      name: 'ニュース',
      sites: ['news.yahoo.co.jp', 'smartnews.com'],
    }

    expect(presetToGroupRule(preset)).toEqual({
      id: 'group-rule-1',
      type: 'group',
      name: 'ニュース',
      urls: ['news.yahoo.co.jp', 'smartnews.com'],
      enabled: true,
      restrictions: [{ type: 'full_block' }],
      preset: true,
      createdAt: NOW,
      updatedAt: NOW,
    })
  })
})

describe('presets', () => {
  it('should have at least one preset', () => {
    expect(presets.length).toBeGreaterThan(0)
  })

  it('should have unique preset names', () => {
    const names = presets.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('should have non-empty sites in each preset', () => {
    for (const preset of presets) {
      expect(preset.sites.length).toBeGreaterThan(0)
    }
  })
})
