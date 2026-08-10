# Active plan

Use this file only for current Significant, Large, or Critical work. Replace completed task detail with the idle state after durable facts and lessons have been synchronized.

## Current status

The production permission incident remains open. The previous release fixed real wallet-schema, roster-repair, and account-scoped status defects, but the user still receives `permission-denied` and the sidebar retains `Failed, action required`. A fresh read-only inspection found that live top-level fields, nested wallet/member fields, and Firestore wire types all match the deployed validators. No corrupted production document has been identified.

The exact rejected mutation is still unknown. Production currently logs a redacted mutation fingerprint only to the affected browser console, and automated access to the user's authenticated Chrome session is blocked by a local Windows sandbox ACL. This invalidates any plan that assumes another schema mismatch.

Classification: **Critical / AIDOS L3**. Recommended route: strongest available engineering model with deep reasoning and full auth/Rules/data/deployment context.

## Phase 1 - Capture decisive evidence

1. [in_progress] Reproduce one failure and capture a privacy-safe diagnostic containing action name, collection, operation, mutation type, Firebase error code, timestamp, and booleans for auth UID = profile UID and auth UID in household roster.
2. [pending] Add an in-app `Copy diagnostics` action to the failed sync state so production incidents do not depend on DevTools or remote browser access.
3. [pending] Run a read-only identity graph audit comparing Firebase Auth UIDs, `users/{uid}`, `houses.memberUids`, `memberMap`, and profile `houseId/role`; output counts and mismatch categories only.

**Gate:** Do not change authorization until a specific mutation and failed invariant are identified.

## Phase 2 - Reproduce the rejection deterministically

1. [pending] Build anonymized fixtures from the verified production document shapes.
2. [pending] Replay the exact client payload against the Firestore Rules emulator with the same auth role.
3. [pending] Add a table-driven mutation contract suite covering profile identity/avatar/wallet, card CRUD, personal expense CRUD, household expense CRUD with ledger revision, house changes, comments, and settlements.

**Gate:** The production symptom must fail before the fix and pass after it.

## Phase 3 - Apply the smallest root-cause fix

1. [pending] If identity linkage is wrong, back up first and repair only the mismatched profile/roster references.
2. [pending] If payload and Rules diverge, normalize the client payload or update the exact validator without broadening ownership or membership permissions.
3. [pending] If the token targets the wrong Firebase project or stale account, correct deployment configuration and force a clean auth-session reset.
4. [pending] If a background reconciliation alone is failing, separate its warning from user-initiated mutation state and clear it only after an authoritative successful read/write.

## Phase 4 - Validate and roll out safely

1. [pending] Run focused regressions, all frontend tests, Rules emulator tests, backend logic tests, type-check, lint, build, and production-preview browser verification.
2. [pending] Create a fresh private production backup and rerun the integrity/identity audits.
3. [pending] Deploy Rules before the client when compatibility requires it, release one canary flow, then push `main`.
4. [pending] Verify GitHub Pages and Vercel serve the same new bundle and have no public runtime errors.

Rollback: redeploy the prior Rules revision and revert the client release commit. Never delete production data to hide a permission failure.

## Phase 5 - Production acceptance

The incident closes only when all of these pass:

- A hard refresh shows `Synced`, with zero queued or failed mutations.
- A leader and a member can each complete an allowed profile or wallet update.
- Personal card and expense create/update/delete operations persist after logout/login.
- Household expense create/update/delete persists and advances the ledger revision atomically.
- A deliberately unauthorized action is still denied without contaminating later successful sync state.
- All three household users can log in and see the same authoritative household state.
