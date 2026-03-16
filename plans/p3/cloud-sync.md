# クラウド同期

複数デバイス間でブロック設定やストリークを同期する。
Googleアカウントでログインし、Firebaseをバックエンドに使用する。

---

## 機能

- Googleアカウントでログイン（chrome.identity API）
- 全データをFirestoreに保存・同期
- デバイス間でリアルタイム同期（Firestoreのリアルタイムリスナー）
- オフライン時はローカルで動作し、オンライン復帰時に同期
- ログアウト時はローカルデータのみで動作

---

## 同期対象データ

| データ | 説明 | 競合解決 |
|--------|------|----------|
| Settings.blockRules | ブロックルール一覧 | マージ（ID単位で追加/更新/削除を判定） |
| Settings.locations | 登録場所 | マージ（ID単位） |
| Settings.streakDisplayMode | 表示設定 | 最終更新が勝つ（Last Write Wins） |
| StreakData | ストリーク記録 | マージ（日付単位で合算） |
| DailyStats | 日次統計 | マージ（各カウンターの最大値を採用） |

---

## 技術構成

| 項目 | 技術 |
|------|------|
| 認証 | Firebase Auth + Google Sign-In |
| Chrome連携 | chrome.identity API（OAuthトークン取得） |
| データベース | Cloud Firestore |
| リアルタイム同期 | Firestore onSnapshot リスナー |
| オフライン対応 | Firestore offline persistence |

### Firestoreデータ構造

```
users/
  {uid}/
    settings/
      current          # Settings オブジェクト
    streak/
      data             # StreakData オブジェクト
    dailyStats/
      {date}           # DailyStats オブジェクト（日付ごと）
    meta/
      lastSync         # 最終同期タイムスタンプ
```

---

## Chrome API

- `chrome.identity` — Googleアカウント認証（OAuthトークン取得）
- manifest.jsonに `"identity"` 権限を追加
- OAuth2のclient_idをmanifest.jsonに設定

### manifest.json追加設定

```json
{
  "permissions": ["identity"],
  "oauth2": {
    "client_id": "xxxxx.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

---

## タスク

### 認証
- Firebase プロジェクトの作成・設定
- `src/lib/auth.ts` 新規作成
  - `chrome.identity.getAuthToken()` でGoogleトークン取得
  - Firebase Auth に `signInWithCredential()` で認証
  - ログイン/ログアウト/認証状態監視
- manifest.jsonに `identity` 権限と `oauth2` 設定を追加

### 同期ロジック
- `src/lib/sync.ts` 新規作成
  - Firestoreへのデータ読み書き
  - リアルタイムリスナーの管理（onSnapshot）
  - 競合解決ロジック:
    - blockRules/locations: ID単位でマージ（追加・更新・削除を比較）
    - streakDisplayMode: Last Write Wins（updatedAtタイムスタンプで判定）
    - StreakData: 日付単位でマージ
    - DailyStats: 各カウンターの最大値を採用（デバイスAで3回、Bで2回 → 3回）
  - オフライン→オンライン復帰時の差分同期

### Background SW連携
- `src/background/index.ts` に同期の初期化を追加
  - 認証状態に応じてリアルタイムリスナーをon/off
  - ローカルStorage変更時にFirestoreへ書き込み
  - Firestore変更時にローカルStorageを更新

### UI
- 設定ページに「アカウント」セクションを追加:
  - ログイン状態の表示（Googleアカウント名・アイコン）
  - ログイン/ログアウトボタン
  - 同期ステータス（最終同期日時・同期中インジケーター）
  - 「今すぐ同期」ボタン
- ポップアップに同期ステータスアイコンを追加

---

## 画面設計

### 設定ページ - アカウント

```
┌──────────────────────────────────────────────────┐
│ ■ アカウント                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🟢 ログイン中: watanabe@gmail.com            │ │
│ │ 最終同期: 2026-03-16 18:30                   │ │
│ │                                              │ │
│ │ [今すぐ同期]  [ログアウト]                     │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 設定ページ - 未ログイン時

```
┌──────────────────────────────────────────────────┐
│ ■ アカウント                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ 複数デバイスでブロック設定やストリークを        │ │
│ │ 同期するにはログインしてください。              │ │
│ │                                              │ │
│ │ [Googleアカウントでログイン]                    │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### ポップアップ - 同期ステータス

```
┌──────────────────────────────────┐
│ LockInTime              ☁️ 同期中 │
├──────────────────────────────────┤
```

---

## 考慮事項

### 初回ログイン時
- ローカルに既存データがある場合、クラウドとマージするかクラウドで上書きするか選択ダイアログを表示

### データ量
- DailyStatsは日単位のドキュメント。古いデータ（90日以上前）は自動削除してコスト抑制
- StreakDataも直近365日分に制限

### セキュリティ
- Firestoreセキュリティルール: 各ユーザーは自分のデータのみ読み書き可能
- OAuthトークンの安全な管理（chrome.identity APIが担保）

### Firebase料金
- 無料枠（Spark）: Firestore 1GB, 読み取り50,000/日, 書き込み20,000/日
- 個人利用なら無料枠で十分。ユーザー増加時はBlaze（従量課金）に移行

---

## 完了条件

- Googleアカウントでログインできる
- ログイン後、ブロックリスト・ストリーク・DailyStats・表示設定がFirestoreに保存される
- 別デバイスでログインすると同じデータが同期される
- オフライン時もローカルで正常動作する
- オンライン復帰時に差分が同期される
- ログアウト後はローカルデータのみで動作する
- `npm run build` / `npm test` が通る
