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
| - | [ロックモード](./p2/lock-mode.md) | P2 |
| - | [一時解除](./p1/temporary-bypass.md) | P1 |
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

## 料金プラン

詳細: [pricing.md](./pricing.md)

| プラン | 月額 | 年額 | 買い切り | 主な機能 |
|--------|------|------|---------|----------|
| Free | 無料 | - | - | 完全ブロック + 使用時刻制限（5サイトまで） |
| Pro | 300円〜 | 3,000円〜 | 4,800円〜 | 全7制限タイプ + グループ + 無制限 + ストリーク |
| Cloud | 480円〜 | 4,800円〜 | - | Pro + クラウド同期 + バックアップ（サブスクのみ） |

※ 価格はPhase A（ローンチ時）。有料ユーザー数に応じてA→B→C→Dと段階的に値上げ。詳細は [pricing.md](./pricing.md)

---

## フェーズ概要

### MVP: 完全ブロック + 使用時刻制限
大半のユーザーの基本ニーズを満たす最小セット。Free機能 + プラン制限の仕組み。
- 完全ブロック: サイトを常時ブロック + UI一式（ポップアップ・設定ページ・ブロックページ）
- 使用時刻制限: 曜日・時間帯を指定してブロック
- ブロックルール5件上限 + Proアップグレード導線
- オンボーディング（初回セットアップウィザード）
- プライバシーポリシー・利用規約
- Pro 7日間無料トライアル

### P1: 制限タイプ拡張（Pro機能）
より柔軟な制限パターンを追加。Googleログイン + 課金の仕組みを導入。
- 使用回数制限 / 使用時間制限 / クールダウン / 遅延アクセス
- 一時解除（バイパス）
- Google認証 + Stripe決済

### P2: 高度な機能（Pro機能）
体験の強化。
- 位置情報制限 / ストリーク（草ヒートマップ + 数値）
- ロックモード（パスワード保護）

### P3: クラウド同期（Cloud機能）
デバイス間でデータを同期。
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
| 決済 | Stripe (Checkout + Webhook) |

### 技術的制約

| 制約 | 上限 | 対策 |
|------|------|------|
| chrome.storage.local | 約5MB | DailyStats 90日、StreakData 365日で古いデータを自動削除 |
| declarativeNetRequest動的ルール | 5,000件 | Proの「無制限」は実質5,000件上限。実運用で問題になることはまずない |
| Service Worker停止 | 30秒で停止 | chrome.alarmsで定期的にウェイクアップ。状態はstorageに永続化し、再起動時に復元 |

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

// ブロックルール（単体）
interface SiteRule {
  id: string
  type: 'site'
  url: string                     // ドメイン（例: "youtube.com"）
  enabled: boolean
  restriction: RestrictionConfig
  createdAt: number
}

// ブロックルール（グループ）
interface GroupRule {
  id: string
  type: 'group'
  name: string                    // グループ名（例: "SNS", "仕事中NG"）
  urls: string[]                  // ドメインのリスト
  enabled: boolean                // グループ単位のON/OFF
  restriction: RestrictionConfig  // グループ内全サイトに同じ制限を適用
  preset: boolean                 // true=プリセット由来, false=カスタム
  createdAt: number
}

// ブロックルール（単体 or グループ）
type BlockRule = SiteRule | GroupRule

// 登録場所
interface Location {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
}

// ランタイム状態（ユーザーのローカル時刻0:00で日次リセット）
interface DailyStats {
  date: string                              // ローカル日付 "2026-03-16"
  counts: Record<string, number>            // ruleId → アクセス回数
  durations: Record<string, number>         // ruleId → 累積秒数
}

// クールダウン用（DailyStatsとは独立、日次リセットの影響を受けない）
interface CooldownState {
  lastAccess: Record<string, number>        // ruleId → 最終アクセスtimestamp
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

## プリセット・グループ

### ルールの種類

ブロックルールには**単体**と**グループ**の2種類がある。

| 種類 | 説明 | 例 |
|------|------|-----|
| **単体（SiteRule）** | 1つのドメインに1つの制限 | youtube.com に使用時間制限30分 |
| **グループ（GroupRule）** | 複数ドメインにまとめて同じ制限 | SNS全体に平日9-18時ブロック |

### グループのルール
- グループに設定した制限は中の全サイトに一括適用
- グループ単位でON/OFF可能（1タップで全サイトのブロック切替）
- 個別サイトに別の制限をつけたい場合はグループから外して単体ルールで管理
- プリセット（定義済みグループ）とカスタムグループ（ユーザー作成）の両方に対応

### プリセット一覧

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
