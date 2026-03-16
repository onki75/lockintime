# 使用時間制限

1日あたりの合計閲覧時間を制限する。
「YouTubeは1日30分まで」のようなユースケースに対応。

---

## 機能

- アクティブタブでの滞在時間を計測・累積
- 設定した上限に達したらブロック
- 毎日0:00に累積時間リセット

---

## Chrome API

- `chrome.tabs` — アクティブタブの監視（滞在時間計測）
- `chrome.storage` — DailyStats保存
- `chrome.alarms` — 1分ごとの累積更新 + 日次リセット

---

## タスク

### Background
- `src/background/tab-tracker.ts` 新規作成（クールダウンと共通基盤）
  - `chrome.tabs.onActivated` / `chrome.tabs.onUpdated` でアクティブタブを監視
  - 対象ドメインのタブがアクティブな間、滞在時間をカウント
  - `chrome.alarms` で1分ごとに `DailyStats.durations` を更新
- `DailyStats.durations` が `maxMinutes` に達したらブロック
- `rule-sync.ts` を拡張: `daily_duration` タイプ対応

### UI
- サイト追加ダイアログ: 最大分数の入力
- ポップアップ: 「残り15分」のようなステータス表示
- 設定ページ: 編集ダイアログで最大分数の変更
- ブロックページ: 「本日の残り時間: 0分」メッセージ

### manifest.json
- `tabs` 権限を追加

---

## 画面設計

### サイト追加ダイアログ

```
│ ○ 使用時間制限  1日 [30] 分まで  │
```

### ポップアップ表示

```
│ ⏱ nicovideo.jp      残り15分    │
```

### ブロックページメッセージ

```
│ このサイトはブロック中です          │
│      nicovideo.jp                │
│ 本日の残り時間: 0分               │
```

---

## 完了条件

- アクティブタブの滞在時間が正しく計測される
- 上限到達後にブロックされる
- タブを切り替えると計測が停止する
- 0:00に累積時間がリセットされる
- `npm run build` / `npm test` が通る
