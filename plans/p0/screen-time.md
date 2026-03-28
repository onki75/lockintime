# スクリーンタイム（使用時間の可視化）

「iPhoneのスクリーンタイムをPCでも」の核心機能。
ブロックリスト内サイトの使用時間をリアルタイムで可視化し、目標設定・比較分析を提供する。

---

## 既存の基盤

以下は実装済みで、そのまま活用できる。

| 既存コード | 場所 | 内容 |
|-----------|------|------|
| `DailyStats.durations` | `types.ts` | サイトごとの使用時間（分） |
| `DailyStats.counts` | `types.ts` | サイトごとのアクセス回数 |
| `dailyStatsHistory` | `BackgroundState` | 日ごとの履歴（過去分を蓄積） |
| `tab-tracker.ts` | `background/` | アクティブタブの滞在時間を計測・記録 |
| `access-counter.ts` | `background/` | `recordDurationForHostname()` で分単位記録 |
| `stats.ts` | `lib/` | `aggregateSiteStats()`, `getWeeklyStatsSummary()` |

**新規に必要なもの:**
- タブ内のリアルタイムカウンター（Content Script）
- 目標設定（Settings拡張）
- 比較ロジック（stats.ts拡張）
- 表示UI（ポップアップ・設定ページ）

---

## 機能1: タブ内リアルタイムカウンター

ブロックリスト内のサイトを閲覧中、タブ内にカウンターを表示する。

### 動作

1. Content Scriptがページ読み込み時にBackground SWに問い合わせ
2. ブロックリスト内のサイトならカウンターUIをDOMに注入
3. `document.visibilityState === 'visible'` の間だけカウントアップ
4. `visibilitychange` イベントでカウントの開始/停止を切り替え
5. 定期的（5秒ごと）にBackground SWに累計時間を送信

### 表示

```
┌──────┐
│⏱ 3:42│  ← 現在のセッション時間（カウントアップ）
│今日   │
│23分   │  ← 今日の累計（Background SWから取得）
└──────┘
```

- 位置: 画面右下に固定表示
- サイズ: 小さめ（80x60px 程度）、邪魔にならない
- 半透明、ホバーで完全表示
- 目標設定時は色で状況を表示:
  - 緑: 0-50%
  - 黄: 50-80%
  - オレンジ: 80-100%
  - 赤: 100%超過

### Chrome API

- Content Script（`delay-gate.ts` と同じパターンでDOMに注入）
- `chrome.runtime.sendMessage` で Background SW に問い合わせ・報告
- `document.visibilityState` + `visibilitychange` イベント

### ファイル

- `src/content/screen-time-counter.ts` — 新規作成
- Content Scriptなので React不使用、DOM直接操作
- `delay-gate.ts` のパターンを踏襲

### メッセージプロトコル

```typescript
// Content Script → Background SW
{ type: 'screen-time:check', hostname: string }
// → Response: { tracked: boolean; todayMinutes: number; goalMinutes: number | null }

{ type: 'screen-time:heartbeat', hostname: string, sessionMs: number }
// → Response: { ok: true }
```

### manifest.json

既存の content_scripts 設定に `screen-time-counter.js` を追加。
`delay-gate.ts` と同じエントリポイントに統合するか、別ファイルにするかは実装時に判断。

---

## 機能2: 目標設定

### データモデル

```typescript
// Settings に追加
interface ScreenTimeGoal {
  enabled: boolean
  dailyLimitMinutes: number  // 1日の目標上限（例: 30分）
}
```

### デフォルト値

```typescript
const DEFAULT_SCREEN_TIME_GOAL: ScreenTimeGoal = {
  enabled: false,
  dailyLimitMinutes: 30,
}
```

### 設定UI（Options ページ）

```
┌──────────────────────────────────────┐
│ スクリーンタイム目標                   │
│                                      │
│ [✓] 1日の目標を設定する              │
│                                      │
│ 目標時間:  [30] 分                   │
│                                      │
│ ※ ブロックリスト内のサイトの          │
│   合計使用時間に対する目標です        │
└──────────────────────────────────────┘
```

### 目標超過時の動作

- カウンターの色が赤に変化
- ポップアップに「目標超過」を表示
- **ブロックはしない**（スクリーンタイムと同じで「気づかせる」のが目的）
- 将来: 目標達成をストリークの成功条件に統合可能

---

## 機能3: 比較ロジック

### 追加する純粋関数（`src/lib/stats.ts` に追加）

```typescript
interface ScreenTimeSummary {
  totalMinutes: number
  siteBreakdown: { domain: string; minutes: number }[]
  goalMinutes: number | null
  goalAchieved: boolean | null  // goal未設定ならnull
}

interface ScreenTimeComparison {
  today: ScreenTimeSummary
  yesterday: ScreenTimeSummary | null
  thisWeekAverage: number         // 分
  lastWeekAverage: number | null  // 分（データなしならnull）
  thisMonthAverage: number        // 分
  lastMonthAverage: number | null // 分
  changeFromYesterday: number | null      // 分（減少ならマイナス）
  changeFromLastWeekPercent: number | null // %（減少ならマイナス）
}

// 今日のスクリーンタイムサマリーを取得
function getTodayScreenTime(
  dailyStats: DailyStats | null,
  goalMinutes: number | null,
): ScreenTimeSummary

// 比較データを生成
function getScreenTimeComparison(
  dailyStats: DailyStats | null,
  dailyStatsHistory: Record<string, DailyStats>,
  goalMinutes: number | null,
  today: string,
): ScreenTimeComparison

// 指定期間の1日平均使用時間
function getAverageDailyMinutes(
  dailyStatsHistory: Record<string, DailyStats>,
  startDate: string,
  endDate: string,
): number

// 目標達成日数（指定期間内）
function getGoalAchievementCount(
  dailyStatsHistory: Record<string, DailyStats>,
  goalMinutes: number,
  startDate: string,
  endDate: string,
): { achieved: number; total: number }
```

---

## 機能4: ポップアップ表示

既存のポップアップに「今日のスクリーンタイム」セクションを追加。

### レイアウト

```
┌──────────────────────────────┐
│ 🛡 LockInTime                │
├──────────────────────────────┤
│                              │
│ 今日のスクリーンタイム        │
│                              │
│ ■■■■■■■■░░░░  23分 / 30分   │
│                              │
│ twitter.com      12分 ■■■■   │
│ youtube.com       8分 ■■■    │
│ reddit.com        3分 ■      │
│                              │
│ 昨日: 45分（-22分）          │
│ 今週平均: 32分               │
│                              │
├──────────────────────────────┤
│ 🔥 12日連続       3月 2026   │
│ （ストリークカレンダー...）    │
├──────────────────────────────┤
│ ブロック中: 8サイト           │
│ [+ 今のサイトをブロック]      │
│        ⚙ 設定を開く          │
└──────────────────────────────┘
```

### プログレスバーの色

| 使用率 | 色 | Tailwind |
|--------|-----|----------|
| 0-50% | 緑 | `bg-emerald-500` |
| 50-80% | 黄 | `bg-amber-400` |
| 80-100% | オレンジ | `bg-orange-500` |
| 100%超 | 赤 | `bg-red-500` |

---

## 機能5: 設定ページ — 週間レポート

Options ページに「スクリーンタイム」タブを追加。

### レイアウト

```
┌──────────────────────────────────┐
│ スクリーンタイム        3/14-3/20│
│                                  │
│ 分                               │
│ 60│      ■                       │
│ 40│  ■   ■       ■              │
│ 20│  ■   ■   ■   ■   ■   ■     │
│  0│──月──火──水──木──金──土──日── │
│                                  │
│ 今週合計: 3時間12分              │
│ 先週比: -18%                     │
│ 最も多い: twitter.com (1時間24分)│
│ 目標達成: 5/7日                  │
│                                  │
│ ─── サイト別 ────────────────── │
│                                  │
│ twitter.com   ■■■■■■■  1h24m    │
│ youtube.com   ■■■■      56m     │
│ reddit.com    ■■        32m     │
│ news.yahoo    ■         20m     │
└──────────────────────────────────┘
```

### 棒グラフの実装

- ライブラリ不使用。Tailwindの `div` + `width` でシンプルに実装
- 各バーの幅 = `(その日の分数 / 最大の日の分数) * 100%`
- 外部依存を増やさない

### 期間切り替え

- 「今週」「先週」「今月」「先月」のタブ切り替え
- デフォルト: 今週

---

## タスク一覧

### ロジック層（TDD）

1. **型定義追加** — `ScreenTimeGoal` を `types.ts` に追加
2. **デフォルト値** — `defaults.ts` に追加
3. **バリデーション** — `validation.ts` に追加
4. **比較ロジック** — `stats.ts` に `getTodayScreenTime`, `getScreenTimeComparison`, `getAverageDailyMinutes`, `getGoalAchievementCount` を追加
5. **マイグレーション** — `Settings` に `screenTimeGoal` フィールドを追加するマイグレーション

### Content Script

6. **タブ内カウンター** — `src/content/screen-time-counter.ts` 新規作成
   - Background SWへの問い合わせ
   - `visibilitychange` によるカウント制御
   - DOM注入（フローティングカウンター）
   - 色の動的変更

### Background SW

7. **メッセージハンドラ** — `screen-time:check` と `screen-time:heartbeat` の処理
   - `tab-tracker.ts` の既存の時間計測と連携

### UI

8. **ポップアップ** — スクリーンタイムセクション追加
9. **設定ページ** — 目標設定UI + 週間レポートUI
10. **manifest.json** — Content Script エントリ追加

---

## 完了条件

- [ ] ブロックリスト内サイト閲覧中にカウンターが表示される
- [ ] カウンターはタブがアクティブな間だけカウントアップする
- [ ] 目標時間を設定でき、超過時にカウンターが赤くなる
- [ ] ポップアップに今日の使用時間サマリーが表示される
- [ ] 設定ページで週間の棒グラフが表示される
- [ ] 昨日・先週との比較が表示される
- [ ] `npm run build` / `npm test` が通る
