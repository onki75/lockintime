# MVP-P3 Backend Execution Plan

## Goal

Chrome 拡張の MVP, P1, P2, P3 を支えるバックエンドと内部APIを、実装時に判断が割れない粒度で定義する。

この計画は UI の見た目ではなく、以下を対象とする。

- 型
- storage schema
- background services
- content/background message contract
- Firebase Auth / Firestore / Functions / Stripe
- emulator での検証フロー

## Final Architecture

### Extension runtime layers

- `src/lib/types.ts`
  全型定義
- `src/lib/storage.ts`
  `chrome.storage.local` への永続化
- `src/background/index.ts`
  orchestration
- `src/background/rule-engine.ts`
  制限判定 pure logic
- `src/background/rule-sync.ts`
  DNR ルール同期
- `src/background/access-counter.ts`
  daily count
- `src/background/tab-tracker.ts`
  daily duration / cooldown
- `src/background/location-checker.ts`
  location polling
- `src/background/runtime-state.ts`
  bypass, cooldown, location, sync state helper
- `src/content/delay-gate.ts`
  delay access gate
- `src/lib/auth.ts`
  chrome.identity + Firebase Auth
- `src/lib/license.ts`
  license cache and feature gates
- `src/lib/sync.ts`
  Firestore sync and merge
- `src/lib/streak.ts`
  streak computation
- `src/lib/stats.ts`
  analytics aggregation
- `src/lib/lock.ts`
  lock mode hashing and challenge contracts

### Cloud/backend layers

- `functions/src/checkout.ts`
  Stripe Checkout session composition
- `functions/src/webhook.ts`
  Stripe webhook parsing and license projection
- `functions/src/license.ts`
  shared license projection rules
- `functions/src/cleanup.ts`
  cloud data retention cleanup
- `infra/firestore.rules`
  access rules
- `infra/firestore.indexes.json`
  indexes

## Storage Schema

### `settings`

```ts
Settings {
  blockRules: BlockRule[]
  adultFilter: boolean
  locations: Location[]
  streakDisplayMode: 'heatmap' | 'number'
  customQuotes: CustomQuote[]
  lockMode: LockModeSettings
  updatedAt: number
}
```

### `backgroundState`

```ts
BackgroundState {
  trialStartDate?: number
  dailyStats: DailyStats | null
  dailyStatsHistory: Record<string, DailyStats>
  cooldownState: CooldownState
  bypassState: BypassState
  locationState: LocationState
  streakData: StreakData
  syncState: SyncState
  authState: AuthState
  licenseCache: LicenseCache
}
```

### `dailyStats` semantics

- key は local date string
- `counts` と `durations` は domain key 単位
- group rule の評価時は group 配下 domain の合計で判定

## Firestore Schema

- `users/{uid}/settings/current`
- `users/{uid}/streak/data`
- `users/{uid}/dailyStats/{date}`
- `users/{uid}/runtime/cooldown`
- `users/{uid}/runtime/lock`
- `users/{uid}/licenses/current`
- `users/{uid}/meta/sync`
- `users/{uid}/tombstones/current`
- `public/pricing/current`

## Rule Evaluation Contract

### Hard block restrictions

- `full_block`
- `time_of_day`
- `daily_count`
- `daily_duration`
- `cooldown`
- `location`

### Soft restriction

- `delay`

### Evaluation order

1. rule disabled -> no effect
2. active bypass -> no hard block and no delay
3. hard block restrictions evaluate
4. delay restriction evaluates separately

### Rule aggregation

- site rule: single domain
- group rule: all `urls`
- domain match is suffix match over hostnames
- group count/duration uses all domains in the group

### Blocked redirect payload

`blocked.html?url={domain}&ruleId={rule.id}&reason={restrictionType}&until={timestamp?}`

`until` is only set when a deterministic unblock time exists:

- `time_of_day`
- `cooldown`
- `bypass` expiration is not a blocked reason and is not sent here

## Feature Implementation Order

### Stage 1: Foundation

- stabilize types
- stabilize defaults and validation
- finalize manifest permissions
- finalize Firebase config access
- finalize function package

### Stage 2: Rule engine

- create `rule-engine.ts`
- migrate all block decisions into pure functions
- create `rule-sync.ts`
- keep `src/lib/rules.ts` as compatibility wrapper

### Stage 3: P1 runtime services

- access counter
- tab tracker
- bypass state helpers
- delay gate message contract

### Stage 4: Billing/auth

- auth state observer
- checkout request composer
- webhook event projection
- local license gating

### Stage 5: P2 services

- location runtime state
- streak finalization
- stats aggregation
- lock mode helpers

### Stage 6: P3 sync

- snapshot merge
- listener start/stop
- echo suppression
- offline recovery
- tombstone-based delete sync

## Tests To Add

### Rule engine

- full block
- in-schedule and out-of-schedule
- daily count threshold
- daily duration threshold
- cooldown active and expired
- location active and inactive
- bypass suppresses block
- delay reported without block

### Runtime state

- bypass prune
- bypass active lookup
- location active id projection

### Functions

- checkout line item selection
- success/cancel URL composition
- webhook event to license plan
- downgrade retention decision

### Integration

- background storage change -> DNR sync
- auth state change -> cloud sync start/stop
- sync force message
- emulator auth/firestore/functions flow

## Worktree Mapping

- `foundation`
- `mvp-rules`
- `p1-tracking`
- `p1-delay-bypass`
- `p1-billing-auth`
- `p2-location`
- `p2-streak-stats`
- `p2-lock`
- `p3-sync`
- `infra-tests`

## Non-negotiable Defaults

- browser target is Chrome only
- billing includes Checkout + Webhook + Firestore license
- emulator is sufficient for completion
- daily stats cloud merge is additive
- same-date streak conflict uses failure precedence
- tombstone delete sync is required for final P3 completion
