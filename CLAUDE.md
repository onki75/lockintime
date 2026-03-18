# CLAUDE.md — LockInTime

## プロジェクト概要
LockInTime は Chrome 拡張機能（Manifest V3）。集中力向上のためのサイトブロッカー＋スクリーンタイム管理ツール。日本語ユーザー向け。

## 技術スタック
- **フロントエンド**: React 19 + TypeScript 5.9 + Tailwind CSS 4 + Vite 8
- **バックエンド**: Firebase (Auth, Firestore, Cloud Functions)
- **決済**: Stripe
- **テスト**: Vitest
- **アイコン**: Lucide React

## ディレクトリ構成
```
src/
  background/    # Service Worker（ルールエンジン、スケジューラ、同期）
  popup/         # ポップアップ UI
  options/       # 設定ページ + オンボーディング
  blocked/       # ブロックページ
  content/       # Content Script
  components/    # 共有 UI コンポーネント
  lib/           # コアロジック（types, storage, auth, sync, rules 等）
functions/       # Firebase Cloud Functions（Stripe連携）
infra/           # Firestore ルール・インデックス
public/          # manifest.json, アイコン, _locales (ja/en)
```

## コマンド
```bash
npm run dev            # 開発サーバー
npm run build          # tsc --noEmit && vite build
npm test               # vitest run（拡張機能側）
npm run test:functions  # Cloud Functions テスト
npm run test:all       # 全テスト実行
npm run build:functions # Cloud Functions ビルド
```

## TDD（テスト駆動開発）
ロジック実装は TDD で進める。

1. **Red**: 失敗するテストを先に書く
2. **Green**: テストを通す最小限の実装を書く
3. **Refactor**: テストが通った状態でリファクタリング

### ルール
- テストを書く前に実装コードを書かない
- 1つのテストが通ったら次のテストへ進む
- UI コンポーネントは TDD の対象外（ロジック層のみ）

## コーディング規約
- **パスエイリアス**: `@/*` → `./src/*`
- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters` 有効
- **テストファイル**: `__tests__/` ディレクトリに配置
- **コンポーネント**: 関数コンポーネント + Hooks、Tailwind インライン
- **コミットメッセージ**: 英語

## 環境変数（`VITE_*`）
Firebase Web Config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

## アーキテクチャ要点
- **Manifest V3** + Service Worker ベース
- **制限タイプ**: `full_block`, `time_of_day`, `daily_count`, `daily_duration`, `cooldown`, `delay`, `location`
- **ストレージ**: Chrome local storage + Firestore 同期（型付きスナップショットマージ）
- **認証**: Firebase Auth + Chrome Identity API
- **ルールシステム**: Chrome Declarative Net Request (DNR) で実装
