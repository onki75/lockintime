# P3 Backend Implementation Notes

## Blocked

- Production Firebase project, OAuth client ID, and Stripe secrets are not available in this repository.
- Chrome Web Store OAuth verification and Firebase production rollout are out of scope for local implementation.

## Deferred

- Stripe Checkout UI and customer portal flows are not implemented in this pass.
- Visual polish for Options and Popup account sections is intentionally minimal.

## Spec gaps

- `DailyStats` merge behavior is inconsistent across planning docs. This implementation uses additive merge for counts and durations.
- Lock mode cloud restoration rules are only partially specified in P2 docs, so only non-secret lock state is synced and advanced recovery/escalation remains local-only.
- Text challenge UX is specified only loosely, so the current implementation treats it as a local confirmation secret rather than a remotely recoverable workflow.

## Operational follow-ups

- Replace manifest OAuth placeholder values before packaging.
- Provision Firebase Auth, Firestore, and Stripe secrets in CI or Firebase environment config.
- Stripe webhook verification and Firebase Functions deployment config now exist in code, but still require real Firebase project IDs, Stripe secrets, and production price catalog values before deployment.
- Add emulator tests that assert Firestore rules deny writes to `users/{uid}/licenses/*`. This machine does not currently have a Java runtime, so Firestore/Auth emulator-based rules tests could not be executed locally.
- If lock mode is intended to resist local power users rather than casual UI misuse, move lock enforcement out of plain local storage assumptions and define a stronger threat model explicitly.
