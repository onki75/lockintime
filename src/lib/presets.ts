import type { GroupRule, SiteRule } from './types'

// 日本の人気サイト ブロック対象プリセット

export interface Preset {
  name: string
  sites: string[]
}

const DEFAULT_RESTRICTIONS = [{ type: 'full_block' }] as const

function createRuleMeta() {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    enabled: true,
    restrictions: [...DEFAULT_RESTRICTIONS],
    createdAt: now,
    updatedAt: now,
  }
}

export function presetToSiteRules(
  preset: Preset,
  selectedUrls?: string[],
): SiteRule[] {
  const selectedUrlSet = selectedUrls ? new Set(selectedUrls) : null

  return preset.sites
    .filter((site) => !selectedUrlSet || selectedUrlSet.has(site))
    .map((url) => ({
      ...createRuleMeta(),
      type: 'site' as const,
      url,
    }))
}

export function presetToGroupRule(preset: Preset): GroupRule {
  return {
    ...createRuleMeta(),
    type: 'group',
    name: preset.name,
    urls: [...preset.sites],
    preset: true,
  }
}

export const presets: Preset[] = [
  {
    name: 'SNS',
    sites: [
      'twitter.com',
      'x.com',
      'instagram.com',
      'facebook.com',
      'threads.net',
      'tiktok.com',
    ],
  },
  {
    name: '動画',
    sites: [
      'youtube.com',
      'nicovideo.jp',
      'tver.jp',
      'abema.tv',
      'twitch.tv',
    ],
  },
  {
    name: 'ニュース',
    sites: [
      'news.yahoo.co.jp',
      'livedoor.com',
      'gunosy.com',
      'smartnews.com',
    ],
  },
  {
    name: '漫画・小説',
    sites: [
      'piccoma.com',
      'manga-bang.com',
      'cmoa.jp',
      'syosetu.com',
      'kakuyomu.jp',
      'comic-days.com',
    ],
  },
  {
    name: '掲示板・まとめ',
    sites: [
      '5ch.net',
      '2ch.sc',
      'reddit.com',
      'matomedane.jp',
    ],
  },
]
