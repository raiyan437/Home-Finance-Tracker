# Active plan

Use this file only for current Significant, Large, or Critical work. Replace completed task detail with the idle state after durable facts and lessons have been synchronized.

## Current status

The production permission incident has two verified root causes. The leader's legacy inline avatar is 351,254 characters while the current profile and roster Rules allow at most 40,000; any wallet/profile or house write that preserves that legacy value is therefore rejected. Separately, the personal-expense form sends `notes: ''` when notes are blank, while the Rules correctly require a present note to contain text.

The identity graph is healthy for all current roster members: every roster UID has a Firebase Auth account and canonical profile, and profile/roster house links agree. One unrelated orphan profile exists outside the current roster and is deliberately left untouched.

Commit `f0f958b` is deployed. Both documented production hosts return HTTP 200 and serve `assets/index-Cjci64QM.js`; the Vercel public shell renders without captured console errors. Authenticated acceptance remains pending because the user's session is not available to automation.

Classification: **Critical / AIDOS L3**. Recommended route: strongest available engineering model with deep reasoning and full auth/Rules/data/deployment context.

## Phase 1 - Capture decisive evidence

1. [completed] Reproduced the failures from production-shaped data and isolated the rejected invariants.
2. [completed] Ran a privacy-safe schema, wire-type, avatar-size, and identity-graph audit.
3. [completed] Avoided broad diagnostic UI changes after deterministic evidence identified both payload defects.

**Gate:** Do not change authorization until a specific mutation and failed invariant are identified.

## Phase 2 - Reproduce the rejection deterministically

1. [completed] Built an anonymized 351 KB legacy-avatar fixture from the verified production shape.
2. [completed] Proved in the emulator that the avatar blocks wallet writes but does not block a correctly formed household ledger transaction.
3. [completed] Added regressions for the avatar boundary and invalid empty personal notes.

**Gate:** The production symptom must fail before the fix and pass after it.

## Phase 3 - Apply the smallest root-cause fix

1. [completed] Added automatic in-browser normalization for oversized legacy inline avatars, then persists the compact value to both the canonical profile and roster.
2. [completed] Omit blank personal-expense notes instead of sending an invalid empty string.
3. [completed] Kept authentication, business logic, UI, and Rules authorization unchanged; no production data was deleted.

## Phase 4 - Validate and roll out safely

1. [completed] Passed 60 frontend tests, 19 Rules tests, 10 backend tests, type-check, lint, build, and production-preview browser verification.
2. [completed] Used the fresh private production backup and read-only identity/schema audits; no destructive repair is required.
3. [completed] Committed and pushed `f0f958b` to `main`; no Rules deployment was required.
4. [completed] Verified GitHub Pages and Vercel serve the same new bundle; the production public shell is clean.

Rollback: redeploy the prior Rules revision and revert the client release commit. Never delete production data to hide a permission failure.

## Phase 5 - Production acceptance

The incident closes only when all of these pass:

- A hard refresh shows `Synced`, with zero queued or failed mutations.
- A leader and a member can each complete an allowed profile or wallet update.
- Personal card and expense create/update/delete operations persist after logout/login.
- Household expense create/update/delete persists and advances the ledger revision atomically.
- A deliberately unauthorized action is still denied without contaminating later successful sync state.
- All three household users can log in and see the same authoritative household state.
