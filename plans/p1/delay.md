# 遅延アクセス

アクセス時に待ち時間を挟む。ブロックはしないが、衝動的なアクセスを抑制する。
「YouTube開くと10秒待たされる」のようなユースケースに対応。

---

## 機能

- 対象サイトにアクセスすると、フルスクリーンの待機画面が表示される
- カウントダウン + プログレスバー
- カウントダウン完了後、ページが閲覧可能になる
- 「やっぱりやめる」ボタンで前のページに戻れる

---

## Chrome API

- Content Script — 待機画面をDOMに注入
- `chrome.runtime.sendMessage` — content scriptからbackgroundに問い合わせ

---

## タスク

### Content Script
- `src/content/delay-gate.ts` 新規作成
  - ページ読み込み時にBackground SWにドメインを問い合わせ
  - 遅延対象の場合、フルスクリーンの待機画面をDOMに注入
  - カウントダウン表示 + プログレスバー
  - 「やっぱりやめる」→ タブを閉じる or 前のページに戻る
  - カウントダウン完了 → 待機画面を除去してページ表示

### Background
- message listener: content scriptからの問い合わせに応答
- `delay` タイプはdeclarativeNetRequestではなくcontent script経由で制御

### UI
- サイト追加ダイアログ: 遅延秒数の入力
- ポップアップ: 「10秒遅延」のようなステータス表示

### manifest.json
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}
```

### Vite設定
vite.config.tsのrollupOptions.inputに content script エントリを追加:
```typescript
input: {
  // 既存エントリ...
  content: resolve(__dirname, 'src/content/delay-gate.ts'),
}
```
- content scriptはReactを使わない（DOM直接操作）→ バンドルサイズを小さく保つ
- `output.entryFileNames: '[name].js'` で `content.js` として出力

---

## 画面設計

### サイト追加ダイアログ

```
│ ○ 遅延アクセス  [10] 秒待機  │
```

### 待機画面（content scriptで注入）

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

## 完了条件

- 対象サイトにアクセスすると待機画面が表示される
- カウントダウン完了後にページが閲覧可能になる
- 「やっぱりやめる」で前のページに戻れる
- 遅延対象でないサイトには影響しない
- `npm run build` / `npm test` が通る
