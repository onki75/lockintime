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
| - | [ロックモード・チャレンジ・Nuclear Option](./p2/lock-mode.md) | P2 |
| - | [利用統計・インサイト](./p2/stats.md) | P2 |
| - | [アダルトフィルター](./mvp/adult-filter.md) | MVP |
| - | [一時解除](./p1/temporary-bypass.md) | P1 |
| - | [モチベーション名言](./p1/motivational-quotes.md) | P1 |
| - | URLパスレベルブロック | P1 |
| - | 制限接近通知 | P1 |
| - | データエクスポート/インポート | P1 |
| - | Edge対応 | P1 |
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
| Pro | 300円〜 | 3,000円〜 | 5,800円〜 | 全7制限タイプ + グループ + 無制限 + ストリーク |
| Cloud | 480円〜 | 4,800円〜 | - | Pro + クラウド同期 + バックアップ（サブスクのみ） |

※ 価格はPhase A（ローンチ時）。有料ユーザー数に応じてA→B→C→Dと段階的に値上げ。詳細は [pricing.md](./pricing.md)

---

## フェーズ概要

### MVP: 完全ブロック + 使用時刻制限
大半のユーザーの基本ニーズを満たす最小セット。Free機能 + プラン制限の仕組み。
- 完全ブロック: サイトを常時ブロック + UI一式（ポップアップ・設定ページ・ブロックページ）
- 使用時刻制限: 曜日・時間帯を指定してブロック
- ブロックルール5件上限 + Proアップグレード導線
- アダルトフィルター（ON/OFF、件数カウント外）
- 一時解除（Free: 5分のみ）
- 拡張アイコンバッジ（有効ルール数を表示、P2でストリーク日数に切替）
- オンボーディング（初回セットアップウィザード）
- プライバシーポリシー・利用規約
- Pro 7日間無料トライアル

### P1: 制限タイプ拡張（Pro機能）
より柔軟な制限パターンを追加。Googleログイン + 課金の仕組みを導入。
- 使用回数制限 / 使用時間制限 / クールダウン / 遅延アクセス
- URLパスレベルブロック（例: youtube.com/shorts だけブロック）
- 制限接近通知（「残り5分」「残り1回」をchrome.notificationsで表示）
- 一時解除（Pro版: 時間選択肢拡張）
- モチベーション名言（カスタム名言・ON/OFF）
- データエクスポート/インポート（JSON形式、Free含む全プラン）
- Google認証 + Stripe決済
- Edge Add-ons対応（Manifest V3共通）

### P2: 高度な機能（Pro機能）
体験の強化。
- 位置情報制限 / ストリーク（草ヒートマップ + 数値）
- ロックモード・チャレンジ・Nuclear Option（3段階保護）
- 利用統計・インサイト（週次サマリー・サイト別統計）

### P3: クラウド同期（Cloud機能）
デバイス間でデータを同期。
- Firebase（Firestore）でリアルタイム同期
- 同期対象: ブロックリスト・ストリーク・DailyStats・表示設定

### Future: スコープ外
- 週次レポート（マスコットキャラ）
- 集中モード（ポモドーロタイマー）
- YouTube特化ブロック（ショート・コメント・おすすめ非表示）
- ホワイトリストモード
- Firefox対応

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
| chrome.storage.local | 約5MB | DailyStats 90日、StreakData 365日で古いデータを自動削除（日次リセットのalarm時に実行） |
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
  | { type: 'location'; locationIds: string[] }  // 複数場所OK（OR: どれかの圏内でブロック）

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
  url: string                       // ドメイン（例: "youtube.com"）
  enabled: boolean
  restrictions: RestrictionConfig[] // 複数制限を重ねがけ可能（全て満たした時のみアクセス可）
  createdAt: number
}

// ブロックルール（グループ）
interface GroupRule {
  id: string
  type: 'group'
  name: string                      // グループ名（例: "SNS", "仕事中NG"）
  urls: string[]                    // ドメインのリスト
  enabled: boolean                  // グループ単位のON/OFF
  restrictions: RestrictionConfig[] // グループ内全サイトに同じ制限を適用
  preset: boolean                   // true=プリセット由来, false=カスタム
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
  blockRules: BlockRule[]          // 通常ルール（Free 5件制限の対象）
  adultFilter: boolean             // アダルトフィルター ON/OFF（件数カウント外）
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

### 複数制限の優先順位

1ルールに複数の制限を設定した場合、**最も厳しい制限が優先**される。

優先順位（高い順）:
1. `full_block` — 常時ブロック（他の制限は無視）
2. `location` — 場所ベースのブロック
3. `time_of_day` — 時間帯ブロック
4. `daily_count` — 回数制限超過でブロック
5. `daily_duration` — 時間制限超過でブロック
6. `cooldown` — クールダウン中ブロック
7. `delay` — 遅延のみ（ブロックしない）

例: `full_block` + `delay` → `full_block` が優先、`delay` は無視される。
例: `time_of_day` + `daily_count` → 時間帯外はブロック、時間帯内でも上限超過ならブロック。

### プリセット一覧

| カテゴリ | 対象サイト |
|----------|-----------|
| SNS | twitter.com, x.com, instagram.com, facebook.com, threads.net, tiktok.com |
| 動画 | youtube.com, nicovideo.jp, tver.jp, abema.tv, twitch.tv |
| ニュース | news.yahoo.co.jp, livedoor.com, gunosy.com, smartnews.com |
| 漫画・小説 | piccoma.com, manga-bang.com, cmoa.jp, syosetu.com, kakuyomu.jp, comic-days.com |
| 掲示板・まとめ | 5ch.net, 2ch.sc, reddit.com, matomedane.jp |

### プリセット更新方針
- プリセットのURL一覧は `src/lib/presets.ts` にハードコード
- 新しいサービス（Bluesky等）の追加は**拡張のアップデート時**に反映
- ユーザーがカスタムグループで自由に追加できるため、プリセットの更新頻度は低くてよい

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

---

## テスト戦略

### ユニットテスト（Vitest）
- `lib/` のロジック層: storage CRUD、ストリーク計算、制限判定、プリセット
- Chrome APIはモックで対応（`vi.stubGlobal('chrome', ...)`)
- 各フェーズの完了条件に含む

### 手動テスト
- declarativeNetRequestのブロック動作: Chromeに拡張をロードして実際のサイトで確認
- content script注入: 遅延アクセスの待機画面表示
- オンボーディング: 初回インストール・再インストール時の挙動
- プラン制限: Free 5件上限、Pro解放の切替

### 将来（P3以降）
- Cloud同期の競合テスト: 2台のブラウザで同時操作
- Stripe Webhookのテスト: Stripe CLIのテストモードで検証
