# Chrome Web Store 審査・公開

## ステータス: 未提出

## 提出前チェックリスト

### 必須要件
- [ ] manifest.json の permissions が最小限か確認
- [ ] プライバシーポリシーの作成・公開
- [ ] Chrome Web Store デベロッパーアカウント登録（$5 一回払い）
- [ ] ストア掲載情報の作成（下記参照）

### ストア掲載情報

#### 拡張機能名（SEO重要）
```
LockInTime: Site Blocker & Focus Timer
```
※ キーワード「site blocker」「focus」を含める

#### 短い説明（132文字以内）
```
Block distracting websites and stay focused. Track your streaks, earn rewards, and build lasting focus habits — like Screen Time for PC.
```

#### 詳細な説明
```
LockInTime helps you block distracting websites and build lasting focus habits.

Unlike other site blockers that just block and forget, LockInTime uses gamification to keep you motivated:

• Block websites with multiple restriction types (full block, time-of-day, daily duration, cooldown, delay)
• Track your streaks — see how many days you've stayed focused
• Earn rescue passes for consistent focus
• Complete daily challenges for extra motivation
• Location-based blocking for work/study spaces

Think of it as iPhone's Screen Time, but for your PC browser — with Duolingo-style motivation built in.

Free features:
• Unlimited site blocking (no 3-site limit)
• All restriction types
• Streak tracking
• Ad-free

LockInTime is open to feedback — built by @lotta_dev
```

#### カテゴリ
Productivity

#### 言語
日本語 + 英語

### スクリーンショット（必須: 1〜5枚）
- [ ] ポップアップUI（ストリーク表示）
- [ ] ブロックページ
- [ ] 設定ページ（ルール一覧）
- [ ] ブロック追加ダイアログ
- [ ] ストリークカレンダー

### アイコン
- [ ] 128x128 PNG（ストアアイコン）
- [ ] 48x48, 16x16（拡張機能アイコン）— 既存のものを使用

### プライバシーポリシー
- [ ] 作成する（ホスティング先: GitHub Pages or note）
- [ ] データ収集: ローカルストレージのみ、外部送信なし（Free版）
- [ ] Firebase Auth + Firestore 使用の旨を記載（Cloud版）

## 審査のポイント

### よくあるリジェクト理由
1. **権限の過剰要求** — 使わないpermissionがmanifest.jsonにあると落ちる
2. **プライバシーポリシーがない** — 必須
3. **説明と実際の機能の不一致** — ストア説明に書いた機能が実装されていない
4. **リモートコード実行** — eval()やリモートスクリプトの読み込みはNG
5. **ブランド名の無断使用** — 他社商標をタイトルに入れない

### 審査期間
通常 1〜3営業日。初回は長くなることがある。

## 提出手順
1. https://chrome.google.com/webstore/devconsole でデベロッパー登録
2. ZIPファイルをアップロード（`npm run build` → `dist/` をZIP）
3. ストア掲載情報を入力
4. プライバシーポリシーURLを設定
5. 提出 → 審査待ち
