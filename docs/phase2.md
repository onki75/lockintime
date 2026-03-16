# Phase 2: 制限タイプ拡張

Phase 1のUIとブロック基盤の上に、制限タイプを1つずつ追加する。

---

## ゴール

- 7種類中5種類の制限タイプが使える（完全ブロック以外の5タイプ）
- サイト追加ダイアログで全タイプを選択できる
- ポップアップ・設定ページに制限タイプ別のステータスが表示される
- ブロックページに制限タイプ別のメッセージが表示される

---

## タスク

### 2-1. 使用時刻制限 + 曜日別スケジュール

**Background:**
- `src/background/time-scheduler.ts` 新規作成
- chrome.alarms APIで1分ごとにチェック
- 現在の曜日・時刻がDayScheduleの範囲内かを判定
- 範囲内 → declarativeNetRequestルールを有効化 / 範囲外 → 無効化
- `rule-sync.ts` を拡張: `time_of_day` タイプのルール同期対応

**UI:**
- サイト追加ダイアログ: 使用時刻制限の選択肢を有効化
  - 曜日選択（平日/休日プリセット + 個別選択）
  - 開始時刻・終了時刻
  - スケジュール複数追加（「+ スケジュール追加」ボタン）
- ポップアップ: 「平日 9:00〜18:00」のようなステータス表示
- 設定ページ: 編集ダイアログでスケジュール変更
- ブロックページ: 「18:00以降にアクセスできます」メッセージ

**manifest.json:**
- `alarms` 権限は既に追加済み

### 2-2. 使用回数制限

**Background:**
- `src/background/access-counter.ts` 新規作成
- chrome.webNavigation.onCommitted でメインフレームのナビゲーションを検知
- DailyStats.counts をインクリメント
- maxCountに達したら declarativeNetRequest でブロック
- `rule-sync.ts` を拡張: `daily_count` タイプ対応

**日次リセット:**
- chrome.alarms で毎日0:00にDailyStatsをリセット
- リセット時にストリーク判定も実行（Phase 3で実装）

**UI:**
- サイト追加ダイアログ: 使用回数制限の選択肢を有効化（最大回数入力）
- ポップアップ: 「残り1回」のようなステータス表示
- ブロックページ: 「本日の残り回数: 0回」メッセージ

**manifest.json:**
- `webNavigation` 権限を追加

### 2-3. 使用時間制限 + クールダウン

**Background（共通基盤）:**
- `src/background/tab-tracker.ts` 新規作成
- chrome.tabs.onActivated / chrome.tabs.onUpdated でアクティブタブを監視
- アクティブタブがブロック対象ドメインの場合、滞在時間をカウント
- chrome.alarms で1分ごとにDailyStats.durationsを更新

**使用時間制限:**
- DailyStats.durations がmaxMinutesに達したらブロック
- `rule-sync.ts` を拡張: `daily_duration` タイプ対応

**クールダウン:**
- DailyStats.lastAccess に最終アクセス時刻を記録
- アクセス時に lastAccess + cooldownMinutes > 現在時刻 → ブロック
- `rule-sync.ts` を拡張: `cooldown` タイプ対応

**UI:**
- サイト追加ダイアログ: 使用時間制限（分数入力）、クールダウン（分数入力）を有効化
- ポップアップ: 「残り15分」「あと20分後」のようなステータス表示
- ブロックページ: 「本日の残り時間: 0分」「あと15分後にアクセスできます」メッセージ

**manifest.json:**
- `tabs` 権限を追加

### 2-4. 遅延アクセス

**Content Script:**
- `src/content/delay-gate.ts` 新規作成
- ページ読み込み時にBackground SWにドメインを問い合わせ
- 遅延対象の場合、フルスクリーンの待機画面をDOMに注入
- カウントダウン表示 + プログレスバー
- 「やっぱりやめる」ボタン → タブを閉じる or 前のページに戻る
- カウントダウン完了 → 待機画面を除去してページを表示

**Background:**
- message listener: content scriptからの問い合わせに応答
- `delay` タイプのルールはdeclarativeNetRequestではなくcontent script経由で制御

**UI:**
- サイト追加ダイアログ: 遅延アクセスの選択肢を有効化（秒数入力）
- ポップアップ: 「10秒遅延」のようなステータス表示

**manifest.json:**
- content_scripts セクションを追加

**Vite設定:**
- content scriptのビルドエントリを追加

---

## 画面設計

### サイト追加ダイアログ（全タイプ有効化後）

```
┌──────────────────────────────────────┐
│ サイトを追加                          │
├──────────────────────────────────────┤
│ ドメイン: [youtube.com           ]   │
│                                      │
│ 制限タイプ:                           │
│ ● 完全ブロック                        │
│ ○ 使用時刻制限                        │
│     平日(月〜金) [09:00]〜[18:00]     │
│     [+ スケジュール追加]               │
│ ○ 使用回数制限  1日 [3] 回まで        │
│ ○ 使用時間制限  1日 [30] 分まで       │
│ ○ クールダウン  [30] 分間隔           │
│ ○ 遅延アクセス  [10] 秒待機           │
│ ○ 位置情報制限  [職場 ▼]  (Phase 3)  │
│                                      │
│            [キャンセル] [追加]         │
└──────────────────────────────────────┘
```

### 遅延アクセス待機画面（content scriptで注入）

```
┌──────────────────────────────────────────────┐
│                                              │
│               ⏳（アイコン）                   │
│                                              │
│      本当にこのサイトを見ますか？               │
│                                              │
│              あと 7 秒                        │
│         ━━━━━━━━━━░░░░░░░░░░                 │
│                                              │
│     このまま待つとアクセスできます。             │
│     [やっぱりやめる]                           │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 必要なChrome API

| タイプ | 主要API |
|--------|---------|
| 使用時刻制限 | chrome.alarms + declarativeNetRequest |
| 使用回数制限 | chrome.webNavigation + chrome.storage |
| 使用時間制限 | chrome.tabs + chrome.storage |
| クールダウン | chrome.tabs + chrome.storage |
| 遅延アクセス | content script + chrome.runtime.sendMessage |

---

## 完了条件

- 全6制限タイプ（完全ブロック含む）がサイト追加ダイアログから選択・設定できる
- 各タイプが正しく動作する（ブロック/許可の切替が期待通り）
- ポップアップに制限タイプ別のステータスが表示される
- ブロックページに制限タイプ別のメッセージが表示される
- 遅延アクセスの待機画面が表示され、カウントダウン後にページが閲覧可能になる
- `npm run build` が通る
- `npm test` が通る
