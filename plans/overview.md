# LockInTime 計画書

## プロダクト概要

日本語特化のサイトブロッカー Chrome拡張機能。
7種類の制限タイプを提供し、ユーザーの生活パターンに合わせた柔軟なサイトアクセス管理を実現する。

---

## ターゲットユーザー

- 仕事中・勉強中にSNSや動画サイトを見てしまう人
- PCでのスクリーンタイムを自己管理したい人
- 日本語の主要サイト（YouTube、X、ニコニコ、漫画サイト等）をブロックしたい人

---

## 制限タイプ一覧

| # | タイプ | フェーズ |
|---|--------|---------|
| 1 | [完全ブロック](./mvp/blocking.md) | MVP |
| 2 | [使用時刻制限 + 曜日別スケジュール](./mvp/time-of-day.md) | MVP |
| 3 | [使用回数制限](./p1/daily-count.md) | P1 |
| 4 | [使用時間制限](./p1/daily-duration.md) | P1 |
| 5 | [クールダウン](./p1/cooldown.md) | P1 |
| 6 | [遅延アクセス](./p1/delay.md) | P1 |
| 7 | [位置情報制限](./p2/location.md) | P2 |
| - | [ストリーク](./p2/streak.md) | P2 |
| - | [クラウド同期](./p3/cloud-sync.md) | P3 |

### 実装の依存関係

```
グループA（独立して実装可能）
  ① 完全ブロック ← declarativeNetRequestのみ
  ② 使用時刻制限 ← alarms + ①のルール制御
  ③ 使用回数制限 ← アクセスカウント + ①のルール制御
  ⑥ 遅延アクセス ← content script（独立）

グループB（タブ監視基盤が共通）
  ④ 使用時間制限 ← アクティブタブ滞在時間の計測
  ⑤ クールダウン ← 最終アクセス時刻の記録

グループC（位置情報基盤）
  ⑦ 位置情報制限 ← Geolocation + 場所の登録管理
```

---

## フェーズ概要

### MVP: 完全ブロック + 使用時刻制限
大半のユーザーの基本ニーズを満たす最小セット。
- 完全ブロック: サイトを常時ブロック + UI一式（ポップアップ・設定ページ・ブロックページ）
- 使用時刻制限: 曜日・時間帯を指定してブロック

### P1: 制限タイプ拡張
より柔軟な制限パターンを追加。
- 使用回数制限 / 使用時間制限 / クールダウン / 遅延アクセス

### P2: 高度な機能
体験の強化。
- 位置情報制限 / ストリーク（草ヒートマップ + 数値）

### P3: クラウド同期
デバイス間でデータを同期。
- Googleアカウント認証（chrome.identity API）
- Firebase（Firestore）でリアルタイム同期
- 同期対象: ブロックリスト・ストリーク・DailyStats・表示設定

### Future: スコープ外
- 週次レポート（マスコットキャラ）
- 集中モード（ポモドーロタイマー）
- 統計ダッシュボード
- インポート/エクスポート
- ホワイトリストモード
- 通知機能

---

## 技術構成

| 項目 | 技術 |
|------|------|
| 拡張形式 | Chrome Extension Manifest V3 |
| ブロック方式 | declarativeNetRequest（動的ルール） |
| タブ監視 | chrome.tabs + chrome.webNavigation |
| タイマー | chrome.alarms |
| 位置情報 | Geolocation API |
| Content Script | 遅延アクセスの待機画面注入 |
| データ保存 | chrome.storage.local |
| クラウド同期 | Firebase (Firestore + Auth) |
| 認証 | Google Sign-In (chrome.identity API) |
| UI | React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| アイコン | Lucide React |
| ビルド | Vite 8 |
| テスト | Vitest |

---

## データモデル

```typescript
// 制限タイプ
type RestrictionType =
  | 'full_block'        // 完全ブロック
  | 'time_of_day'       // 使用時刻制限
  | 'daily_count'       // 使用回数制限
  | 'daily_duration'    // 使用時間制限
  | 'cooldown'          // クールダウン
  | 'delay'             // 遅延アクセス
  | 'location'          // 位置情報制限

// 制限設定（タイプごとに異なるパラメータ）
type RestrictionConfig =
  | { type: 'full_block' }
  | { type: 'time_of_day'; schedule: DaySchedule[] }
  | { type: 'daily_count'; maxCount: number }
  | { type: 'daily_duration'; maxMinutes: number }
  | { type: 'cooldown'; cooldownMinutes: number }
  | { type: 'delay'; delaySeconds: number }
  | { type: 'location'; locationId: string }

// 曜日（0=日, 1=月, ..., 6=土）
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

// 曜日別スケジュール
interface DaySchedule {
  days: DayOfWeek[]
  startTime: string       // "09:00"
  endTime: string         // "18:00"
}

// ブロックルール
interface BlockRule {
  id: string
  url: string
  enabled: boolean
  restriction: RestrictionConfig
  createdAt: number
}

// 登録場所
interface Location {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
}

// ランタイム状態（日次リセット）
interface DailyStats {
  date: string
  counts: Record<string, number>
  durations: Record<string, number>
  lastAccess: Record<string, number>
}

// ストリーク記録
interface StreakRecord {
  date: string
  success: boolean
}

// ストリークデータ
interface StreakData {
  perRule: Record<string, StreakRecord[]>
  global: StreakRecord[]
}

type StreakDisplayMode = 'heatmap' | 'number'

// アプリ設定
interface Settings {
  blockRules: BlockRule[]
  locations: Location[]
  streakDisplayMode: StreakDisplayMode
}
```

---

## プリセット

| カテゴリ | 対象サイト |
|----------|-----------|
| SNS | twitter.com, x.com, instagram.com, facebook.com, threads.net, tiktok.com |
| 動画 | youtube.com, nicovideo.jp, tver.jp, abema.tv, twitch.tv |
| ニュース | news.yahoo.co.jp, livedoor.com, gunosy.com, smartnews.com |
| 漫画・小説 | piccoma.com, manga-bang.com, cmoa.jp, syosetu.com, kakuyomu.jp, comic-days.com |
| 掲示板・まとめ | 5ch.net, 2ch.sc, reddit.com, matomedane.jp |

---

## ファイル構成

```
src/
├── background/
│   ├── index.ts              # Service Worker エントリ
│   ├── rule-sync.ts          # declarativeNetRequest ルール同期
│   ├── tab-tracker.ts        # アクティブタブ監視（時間制限・クールダウン）
│   ├── access-counter.ts     # アクセス回数カウント
│   ├── time-scheduler.ts     # 使用時刻制限（alarms）
│   └── location-checker.ts   # 位置情報チェック
├── content/
│   └── delay-gate.ts         # 遅延アクセス待機画面
├── blocked/
│   ├── index.tsx             # ブロックページ エントリ
│   └── Blocked.tsx           # ブロックページ UI
├── popup/
│   ├── index.tsx             # ポップアップ エントリ
│   └── Popup.tsx             # ポップアップ UI
├── options/
│   ├── index.tsx             # 設定ページ エントリ
│   └── Options.tsx           # 設定ページ UI
├── components/
│   └── Heatmap.tsx           # GitHub草風ヒートマップ
├── lib/
│   ├── storage.ts            # chrome.storage ラッパー
│   ├── presets.ts            # プリセット定義
│   ├── streak.ts             # ストリーク計算ロジック
│   ├── auth.ts               # Firebase Auth + chrome.identity
│   ├── sync.ts               # Firestore同期ロジック
│   └── types.ts              # 共通型定義
└── styles/
    └── global.css            # Tailwind + ベーススタイル
```
