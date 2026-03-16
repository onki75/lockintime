# アダルトフィルター

アダルトサイトをワンタップでブロックする安全機能。
通常のブロックルール（5件制限）とは別枠で管理し、Free/Pro/Cloud全プランで利用可能。

---

## 機能

- 設定ページ・ポップアップに「アダルトフィルター ON/OFF」トグル
- ONにすると約50万件のアダルトドメインを一括ブロック
- 通常のブロックルール件数にカウントしない（別枠管理）
- ブロック時はブロックページを表示（通常のブロックと同じ）

---

## ドメインリスト

### ソース
- [Block List Project - Porn](https://blocklistproject.github.io/Lists/)（50万+ドメイン、Unlicenseライセンス）
- 補助: [OISD NSFW](https://oisd.nl/)

### 取り込み方法
- **ビルド時にリストをダウンロード**してバンドルに含める
- `src/lib/adult-domains.ts` に圧縮して格納（または外部JSONファイル）
- 拡張アップデートのたびに最新リストを反映
- ランタイムの外部API依存なし

### サイズ考慮
- 50万ドメインをそのままバンドルすると数MBになる
- 対策:
  - ドメインリストをgzip圧縮してバンドル、ランタイムで展開
  - または上位1万〜5万ドメイン（トラフィックの多いサイト）に絞る
  - declarativeNetRequestの静的ルール（MAX_NUMBER_OF_STATIC_RULESETS）を活用

---

## Chrome API

- `declarativeNetRequest` — 静的ルールセット（static ruleset）としてアダルトドメインを登録
- `chrome.declarativeNetRequest.updateEnabledRulesets()` でON/OFF切替

### 静的ルールセット vs 動的ルール
- 通常のBlockRuleは**動的ルール**（上限5,000件）
- アダルトフィルターは**静的ルールセット**（上限50件のルールセット、各ルールセット最大30万件）
- 別枠なので動的ルールの上限に影響しない

### manifest.json

```json
{
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "adult_filter",
        "enabled": false,
        "path": "rules/adult-filter.json"
      }
    ]
  }
}
```

---

## タスク

### ビルドパイプライン
- ビルドスクリプトでBlock List Projectからドメインリストをダウンロード
- declarativeNetRequest形式のJSONルールファイルに変換
- `dist/rules/adult-filter.json` として出力

### Background SW
- `Settings.adultFilter` の変更を監視
- ON → `chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['adult_filter'] })`
- OFF → `chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['adult_filter'] })`

### UI
- 設定ページに「アダルトフィルター」セクション
- ポップアップにトグル

---

## 画面設計

### 設定ページ

```
┌──────────────────────────────────────────────────┐
│ ■ アダルトフィルター                               │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🔞 アダルトサイトをブロック       [ON/OFF]    │ │
│ │ 約50万件のアダルトサイトを一括ブロックします   │ │
│ │ ※ ブロックルールの件数にはカウントされません   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### ポップアップ

```
┌──────────────────────────────────┐
│ 🔞 アダルトフィルター    [ON/OFF] │
├──────────────────────────────────┤
│ ブロック中: 5サイト               │
│ ...                              │
```

---

## 完了条件

- アダルトフィルターをONにするとアダルトサイトがブロックされる
- OFFにするとブロックが解除される
- 通常のブロックルール件数にカウントされない
- ブロック対象サイトにアクセスするとブロックページが表示される
- `npm run build` / `npm test` が通る
