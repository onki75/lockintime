# LockInTime 概要

## プロダクト概要

日本語特化のサイトブロッカー Chrome拡張機能。
7種類の制限タイプを提供し、ユーザーの生活パターンに合わせた柔軟なサイトアクセス管理を実現する。

---

## ターゲットユーザー

- 仕事中・勉強中にSNSや動画サイトを見てしまう人
- PCでのスクリーンタイムを自己管理したい人
- 日本語の主要サイト（YouTube、X、ニコニコ、漫画サイト等）をブロックしたい人

---

## 制限タイプ

| # | タイプ | 説明 | 例 |
|---|--------|------|-----|
| 1 | **完全ブロック** | 常時アクセス不可 | YouTubeを完全に断つ |
| 2 | **使用時刻制限** | 曜日・時間帯を指定してブロック | 平日9:00〜18:00はブロック |
| 3 | **使用回数制限** | 1日あたりのアクセス回数を制限 | Xは1日3回まで |
| 4 | **使用時間制限** | 1日あたりの合計閲覧時間を制限 | YouTubeは1日30分まで |
| 5 | **クールダウン** | アクセス後に一定時間空けないと再アクセス不可 | X見たら次は30分後まで不可 |
| 6 | **遅延アクセス** | アクセス時に待ち時間を挟む（ブロックはしない） | YouTube開くと10秒待たされる |
| 7 | **位置情報制限** | 特定の場所にいる間だけブロック | 職場にいる間はSNSブロック |

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

## プリセット

日本の主要サイトをカテゴリ別にまとめたプリセットを提供する。

| カテゴリ | 対象サイト |
|----------|-----------|
| SNS | twitter.com, x.com, instagram.com, facebook.com, threads.net, tiktok.com |
| 動画 | youtube.com, nicovideo.jp, tver.jp, abema.tv, twitch.tv |
| ニュース | news.yahoo.co.jp, livedoor.com, gunosy.com, smartnews.com |
| 漫画・小説 | piccoma.com, manga-bang.com, cmoa.jp, syosetu.com, kakuyomu.jp, comic-days.com |
| 掲示板・まとめ | 5ch.net, 2ch.sc, reddit.com, matomedane.jp |

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
  | { type: 'time_of_day'; schedule: DaySchedule[] }                    // 曜日別スケジュール
  | { type: 'daily_count'; maxCount: number }                          // 1日3回まで
  | { type: 'daily_duration'; maxMinutes: number }                     // 1日30分まで
  | { type: 'cooldown'; cooldownMinutes: number }                      // 30分間隔
  | { type: 'delay'; delaySeconds: number }                            // 10秒待機
  | { type: 'location'; locationId: string }                           // 場所ID

// 曜日（0=日, 1=月, ..., 6=土）
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

// 曜日別スケジュール
interface DaySchedule {
  days: DayOfWeek[]       // 適用する曜日（例: [1,2,3,4,5] = 平日）
  startTime: string       // "09:00"
  endTime: string         // "18:00"
}

// ブロックルール
interface BlockRule {
  id: string                    // UUID
  url: string                   // ドメイン（例: "youtube.com"）
  enabled: boolean              // true=有効, false=一時無効
  restriction: RestrictionConfig
  createdAt: number             // 追加日時（timestamp）
}

// 登録場所
interface Location {
  id: string          // UUID
  name: string        // 表示名（例: "職場"）
  latitude: number    // 緯度
  longitude: number   // 経度
  radiusMeters: number // 半径（メートル）
}

// ランタイム状態（chrome.storage.localに保存、日次リセット）
interface DailyStats {
  date: string                              // "2026-03-16"
  counts: Record<string, number>            // ruleId → アクセス回数
  durations: Record<string, number>         // ruleId → 累積秒数
  lastAccess: Record<string, number>        // ruleId → 最終アクセスtimestamp
}

// ストリーク記録（日単位）
// "成功" = その日ブロック対象サイトにアクセスしなかった（制限を破らなかった）
interface StreakRecord {
  date: string            // "2026-03-16"
  success: boolean        // true=制限を守った
}

// ストリークデータ
interface StreakData {
  perRule: Record<string, StreakRecord[]>  // ruleId → 日別記録
  global: StreakRecord[]                   // 全ルール総合の日別記録
}

// ストリーク表示設定
type StreakDisplayMode = 'heatmap' | 'number'  // 草 or 数値

// アプリ設定
interface Settings {
  blockRules: BlockRule[]
  locations: Location[]
  streakDisplayMode: StreakDisplayMode
}
```

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
├── lib/
│   ├── storage.ts            # chrome.storage ラッパー + 型定義
│   ├── presets.ts            # プリセット定義
│   ├── streak.ts             # ストリーク計算ロジック
│   └── types.ts              # 共通型定義（BlockRule, Location, DailyStats等）
└── styles/
    └── global.css            # Tailwind + ベーススタイル
```

---

## フェーズ一覧

| Phase | 内容 | 詳細 |
|-------|------|------|
| [Phase 0](./phase0.md) | 基盤整理 | データモデル・ストレージ層 |
| [Phase 1](./phase1.md) | 完全ブロック + UI | 最小限の「使える状態」 |
| [Phase 2](./phase2.md) | 制限タイプ拡張 | 時刻・回数・時間・クールダウン・遅延 |
| [Phase 3](./phase3.md) | 高度な機能 | 位置情報・ストリーク |

---

## 将来フェーズ（スコープ外）

- **週次レポート（マスコットキャラ）** — オリジナルマスコットが毎週のスコア（ストリーク達成率・ブロック状況等）とアドバイスを表示
- 集中モード（ポモドーロタイマー）
- 統計ダッシュボード（ブロック回数・使用時間の可視化）
- インポート/エクスポート
- ホワイトリストモード（指定サイト以外を全ブロック）
- 通知機能（制限に近づいたら警告）
