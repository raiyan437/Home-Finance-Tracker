# Testing and validation

Last verified from repository configuration: 2026-08-09.

## Root commands

Run from the repository root:

| Command | Verified purpose |
| --- | --- |
| `npm run lint` | Runs Oxlint over the project. |
| `npm test` | Runs Vitest once against `src`. |
| `npx tsc -b` | Type-checks the referenced application and Vite configuration projects without emitting. |
| `npm run build` | Runs `tsc -b` and then creates the Vite production bundle in `dist/`. |
| `npm run dev` | Starts the Vite development server for local smoke testing. |
| `npm run preview` | Serves the production build for a production-like smoke test. |
| `npm run test:rules` | Starts Firestore and Storage emulators and runs `tests/rules` serially. Requires the Firebase emulator prerequisites, including a compatible Java runtime. |
| `npm run audit:production` | Creates a git-ignored raw Firestore backup and reports aggregate referential-integrity findings. Requires Firebase CLI authentication and is read-only against production. |

`npm run deploy:rules` deploys Firestore Rules only. `npm run deploy:functions` remains a deployment command but cannot succeed on the current Spark project. Deployment commands are not validation.

## Functions commands

Run from `functions/`:

| Command | Verified purpose |
| --- | --- |
| `npm test` | Runs Node's test runner over settlement, comment, and expense logic tests. |
| `npm run lint` | Runs `node --check` against the function entry point and logic modules. |

## Current automated coverage boundaries

- Colocated frontend/domain tests cover finance splits and settlements, ledger invariants, recurring generation, OCR parsing, offline/cache isolation, monthly reporting, wallet ledger/budgets, profile reconciliation, optimistic rollback, and Firebase sync/outbox policy.
- `tests/rules/` exercises Firestore and Storage authorization/schema behavior with emulators.
- `functions/*.test.js` covers extracted trusted settlement, comment, and expense logic.
- `.github/workflows/deploy.yml` runs root lint, root frontend tests, `npx tsc -b`, and the production build. It does **not** currently run rule emulator tests or the `functions/` test/lint scripts.
- `Tester/Tester.md` contains manual feature scenarios. No configured browser end-to-end test runner was found: **NOT ASSESSED** beyond manual guidance.

## Validation policy

1. Run the narrowest tests covering the changed behavior.
2. Run root lint, tests, type-check/build for application changes before publishing.
3. Run function tests/lint for `functions/` changes.
4. Run rule emulator tests for Firestore/Storage rules or authorization-contract changes.
5. Start the development server (or preview build) and smoke-test the affected route/flow after project changes.
6. For finance, auth, security, data, migration, or destructive changes, verify invariants and failure paths; do not rely only on a happy-path UI check.
7. Record the exact commands and outcomes. Mark unrun checks explicitly; never infer success from a build alone.
