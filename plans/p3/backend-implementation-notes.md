# P3 Backend Implementation Notes

## Blocked

- Production Firebase project, OAuth client ID, and Stripe secrets are not available in this repository.
- Chrome Web Store OAuth verification and Firebase production rollout are out of scope for local implementation.

## Deferred

- Stripe Checkout UI and customer portal flows are not implemented in this pass.
- Visual polish for Options and Popup account sections is intentionally minimal.
- Firestore tombstone-based deletion sync for block rules, locations, and custom quotes is not fully wired end-to-end yet.
- Firebase Functions runtime handlers are scaffolded at the pure-logic layer; deployable webhook/cron entrypoints still need Firebase project wiring.
- `access-counter.ts`, `tab-tracker.ts`, `location-checker.ts`, and the real `content/delay-gate.ts` runtime are still pending as concrete runtime modules.
- Lock mode hashing/challenge/Nuclear enforcement logic is not implemented yet beyond schema placeholders.

## Spec gaps

- `DailyStats` merge behavior is inconsistent across planning docs. This implementation uses additive merge for counts and durations.
- Lock mode cloud restoration rules are only partially specified in P2 docs, so the cloud schema stores the state but does not enforce advanced server-side recovery policies.

## Operational follow-ups

- Replace manifest OAuth placeholder values before packaging.
- Provision Firebase Auth, Firestore, and Stripe secrets in CI or Firebase environment config.
- Add real Stripe webhook verification and Firebase Functions deployment config once secrets and project IDs exist.
