# Phase 0: 基盤整理

データモデルとストレージ層を全制限タイプに対応した設計に整える。

---

## ゴール

- 全7制限タイプに対応した型定義が揃っている
- storage.tsのCRUD関数が全タイプで使える状態
- 既存のfocusMode/focusDuration関連コードが削除されている

---

## タスク

### 0-1. 型定義の集約
- `src/lib/types.ts` を新規作成
- 全型を集約: RestrictionType, RestrictionConfig, DaySchedule, BlockRule, Location, DailyStats, StreakRecord, StreakData, Settings
- 既存の `storage.ts` から型定義を移動

### 0-2. ストレージ層の拡張
- `src/lib/storage.ts` をリファクタ
- CRUD関数:
  - `getSettings()` / `saveSettings()`
  - `addRule(url, restriction)` → BlockRuleを生成して追加
  - `removeRule(id)` → 削除
  - `toggleRule(id)` → enabled切替
  - `updateRule(id, partial)` → 部分更新
- DailyStats管理:
  - `getDailyStats()` / `saveDailyStats()`
  - 日付が変わっていたら自動リセット
- StreakData管理:
  - `getStreakData()` / `saveStreakData()`

### 0-3. 既存コードの整理
- `focusMode` / `focusDuration` を Settings型から削除
- `src/lib/rules.ts` → Phase 1で `rule-sync.ts` にリネーム予定（この段階では触らない）

---

## 完了条件

- `npm run build` が通る
- `npm test` が通る（types・storageのテスト追加）
- focusMode関連のコードが残っていない
