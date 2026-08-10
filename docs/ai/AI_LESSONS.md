# Durable AIDOS lessons

Record only reusable, evidence-backed lessons. Include the date and affected area; preserve failed approaches when they can prevent repetition.

## 2026-08-09 ? AIDOS initialization

- Current source and configuration must outrank historical handover/agent analysis. Some existing Gemini documents refer to earlier filenames and proposed gaps that current code has since addressed.
- Hosting knowledge is conflicting: GitHub Pages automation and Vercel routing/links coexist. Verify the actual production target before changing deployment assumptions.
- Git inspection must precede edits. At initialization, `.agents/skills/` and `docs/SRS/` were untracked user-owned content and were deliberately excluded from AIDOS work.
- Security-rule and trusted-function tests are configured separately from the root CI path. Do not assume a green GitHub Pages workflow proves emulator rules or function logic passed.
- Financial, auth/household lifecycle, and synchronization changes cross several boundaries (`App.tsx`, `AuthContext.tsx`, domain engines, sync services, rules, and functions); route them at L3 when integrity or authorization is involved.

## 2026-08-10 ? Authenticated browser testing

- FACT: The dummy credentials documented in `Tester.md` returned HTTP 400 from the default Firebase Identity Toolkit project during the responsive dashboard smoke test.
- Evidence: Desktop and 390x844 browser sessions loaded the unauthenticated shell without runtime errors or overflow, but Firebase rejected `raiyan@gmail.com` / `dummy123`.
- Consequence: Revalidate documented test accounts before relying on them for authenticated UI verification; do not create external Firebase accounts as an implicit testing workaround.
- Failed approach: The repository's documented dummy login could not unlock the authenticated dashboard, so this run verified the responsive public shell plus lint, tests, type-check, and production build instead.

## 2026-08-10 ? Offline queue re-authentication
- FACT: Personal listeners must use an explicit unscoped house value when merging pending mutations; treating `null` as an exact house ID drops queued cards and can overwrite the local cache after a cloud snapshot.
- FACT: Re-authentication must trigger outbox replay because the one-time startup retry can run before Firebase restores the signed-in session.
- Evidence: `src/services/firebaseSync.ts`, `src/App.tsx`, and the regression coverage in `src/services/firebaseSync.test.ts`; full frontend tests and production build passed.
- Consequence: Preserve account/house filtering in all snapshot merges and invoke retry logic after the authenticated profile is ready.

## 2026-08-10 ? Stale sync status reconciliation
- FACT: `getSyncState()` must derive `offline-queued` from live pending outbox records; remembered in-memory transport status can outlive a successful write or browser session.
- FACT: Authoritative Firestore snapshots can confirm a queued mutation that was committed before the client crashed or lost its final callback.
- Evidence: The production bundle previously served both documented hosts with the earlier queue fix, while the new regression tests cover stale-status clearing and authoritative snapshot acknowledgement.
- Consequence: Never display a transport status after its durable queue is empty, and reconcile only non-cache, non-pending-write snapshots so local optimistic data is not discarded prematurely.

## 2026-08-10 ? Production deployment verification
- FACT: Commit `1097661` deployed successfully to both documented production hosts.
- Evidence: GitHub Actions run `31386907276` completed successfully, and both Vercel and GitHub Pages served `assets/index-CMBD4i2S.js` after deployment.
- Consequence: Verify both deployment paths after production fixes because the repository maintains independent Vercel and GitHub Pages delivery paths.

## 2026-08-10 ? Production online-only sync policy
- DECISION: Configured production Firebase builds are online-only. They clear the current and legacy browser outbox at startup, never enqueue new transport failures, and roll back optimistic changes when the cloud write is not confirmed.
- FACT: The live `offline, queued 2` state was caused by two durable local outbox records, not by the current Firestore snapshot status. The previous fix correctly removed stale labels only after the outbox was empty, so the records themselves kept the label alive.
- Evidence: `src/services/firebaseSync.ts` now guards the outbox and retry paths with `import.meta.env.PROD`, and `src/App.tsx` calls `clearOfflineOutbox()` before startup retry/listener effects. `npm test` (55 tests), `npx tsc -b`, `npm run lint`, `npm run build`, and a production-preview HTTP smoke check passed.
- Consequence: Production financial state stays cloud-canonical and a hard refresh cannot resurrect a local queued status. A transient outage is surfaced as a failed action requiring an explicit retry; it is not silently persisted in browser storage.

## Entry template

```text
## YYYY-MM-DD ? Area
- FACT/DECISION: What was learned or decided.
- Evidence: Source, command, test, incident, or commit.
- Consequence: How future work should change.
- Failed approach (if applicable): What failed and why.
```
