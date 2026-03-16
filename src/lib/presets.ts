// 日本の人気サイト ブロック対象プリセット

export interface Preset {
  name: string
  sites: string[]
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
