# 使用回数制限

1日あたりのアクセス回数を制限する。
「Xは1日3回まで」のようなユースケースに対応。

---

## 機能

- サイトへのアクセス回数をカウント
- 設定した上限に達したらブロック
- 毎日0:00にカウントリセット

---

## Chrome API

- `chrome.webNavigation` — メインフレームのナビゲーション検知（カウント）
- `chrome.storage` — DailyStats保存
- `chrome.alarms` — 日次リセット

---

## タスク

### Background
- `src/background/access-counter.ts` 新規作成
  - `chrome.webNavigation.onCommitted` でアクセスを検知
  - `DailyStats.counts` をインクリメント
  - `maxCount` に達したら `declarativeNetRequest` でブロック
- `rule-sync.ts` を拡張: `daily_count` タイプ対応
- 日次リセット: `chrome.alarms` で毎日0:00に `DailyStats` をリセット

### UI
- サイト追加ダイアログ: 最大回数の入力
- ポップアップ: 「残り1回」のようなステータス表示
- 設定ページ: 編集ダイアログで最大回数の変更
- ブロックページ: 「本日の残り回数: 0回」メッセージ

### manifest.json
- `webNavigation` 権限を追加

---

## 画面設計

### サイト追加ダイアログ

```
│ ○ 使用回数制限  1日 [3] 回まで  │
```

### ポップアップ表示

```
│ 🔢 instagram.com     残り1回    │
```

### ブロックページメッセージ

```
│ このサイトはブロック中です          │
│      instagram.com               │
│ 本日の残り回数: 0回               │
```

---

## 完了条件

- アクセス回数が正しくカウントされる
- 上限到達後にブロックされる
- 0:00にカウントがリセットされる
- `npm run build` / `npm test` が通る
