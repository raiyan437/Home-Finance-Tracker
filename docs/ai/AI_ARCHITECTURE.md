# Verified architecture

Last verified: 2026-08-10. This map describes the implementation and verified Spark production deployment, not historical proposals.

## System shape

The project is a React single-page application with a Firebase-backed cloud path and scoped browser persistence. Configured production builds are online-only and use authenticated Firestore transactions plus Firestore Rules for household ledger/comment/settlement mutations. A CommonJS Functions package remains tested source but is not deployed on the Spark project.

```text
Browser
  src/main.tsx
    -> ErrorBoundary
    -> AuthProvider (auth, profile, household lifecycle)
    -> AppContent (routing, state orchestration, sync, optimistic actions)
         -> pages/ and components/
         -> features/ (domain calculations and validation)
         -> services/storage.ts (scoped LocalStorage/cache/backup)
         -> services/firebaseSync.ts (Firestore listeners, direct transactions, scoped status)
         -> services/attachments.ts (Storage integration; unavailable in current production project)

Firebase production
  Auth + Firestore (Spark)
  firestore.rules: authorization/schema and transaction boundary
  no deployed Functions; Storage not initialized
```

## Frontend composition

- `src/main.tsx` mounts `App` in React `StrictMode`.
- `src/App.tsx` owns custom History API routing, top-level ledger/card state, scoped cache hydration, Firebase subscriptions, optimistic mutations/rollback, recurring generation, navigation composition, and modal coordination.
- `src/context/AuthContext.tsx` owns authentication, profile initialization/reconciliation, household membership and leadership lifecycle, and house archival/recovery flows.
- `src/pages/` contains route-level views. Monthly, personal wallet, cards, settings, and house pages are lazy-loaded.
- `src/components/` contains reusable UI and the expense editor. Styling is centralized primarily in `src/index.css`.
- `src/types/index.ts` is the shared domain contract for profiles, houses, expenses, cards, settlements, balances, and budgets.

## Domain layer

- `settlementEngine.ts`: canonical household users, integer balance calculation, zero-sum assertion, and simplified transfers.
- `ledgerValidation.ts`: expense, settlement, and roster invariants.
- `recurringEngine.ts`: date progression and generation of due recurring expenses.
- `monthlyDashboard.ts`: month options, month filtering, as-of ledger boundaries, and reversal timing.
- `personalWalletLedger.ts` and `personalBudget.ts`: cash ledger/checkpoints and budget usage.
- `profileReconciliation.ts`: normalized identity/profile reconciliation.
- `ocrScanner.ts`: receipt text extraction with lazy Tesseract loading.
- `exportCsv.ts`: client-side audit CSV generation.

## Persistence and synchronization

- `storage.ts` uses house- and user-scoped LocalStorage keys for household expenses/settlements/cards and personal expenses. It also validates backup import/export payloads.
- `firebaseSync.ts` subscribes to house expenses, owner personal expenses, settlements, cards, and the current house. It classifies failures and exposes account-scoped sync status. Production never persists failed mutations to an offline outbox.
- Household ledger, comment, and settlement mutations use authenticated Firestore transactions with Rules-enforced invariants on Spark.
- `attachments.ts` stores avatars, receipts, and settlement proofs in Cloud Storage.
- Offline/local authentication support is implemented in `mockAuthDatabase.ts`; stored local credentials are hashed according to current tests.

## Cloud-side boundaries

`functions/index.js` exports the following tested alternatives, but none are deployed in the current Spark project:

- `mutateHouseholdLedger`
- `addExpenseComment`
- `deleteExpenseComment`
- `confirmSettlement`

Firestore collections referenced by current code include `users`, `houses`, `houseCodes`, `houseArchives`, `expenses`, `settlements`, and `cards`. Security behavior is defined by `firestore.rules`, `storage.rules`, and the callable-function validation logic; changes to any of these are Critical unless proven otherwise.

## Build and deployment

- TypeScript uses project references for browser source and `vite.config.ts`; compilation is no-emit.
- Vite builds static assets into `dist/`, uses relative asset paths, and creates manual Firebase, Lucide, and React chunks.
- `vercel.json` rewrites all paths to `index.html` for SPA routing.
- `.github/workflows/deploy.yml` installs with Node 20, lints, runs frontend tests, type-checks/builds, and deploys `dist/` to GitHub Pages on `main`.
- `firebase.json` points to the functions package, Firestore rules/indexes, Storage rules, and Firestore/Storage emulator ports.

## Architecture risks and unassessed areas

- `App.tsx`, `AuthContext.tsx`, and `firebaseSync.ts` are large orchestration units; changes can cross UI, auth, persistence, and offline boundaries. This is an observation, not an authorization to refactor.
- Both Vercel and GitHub Pages are production hosts; each must be verified after a push to `main`.
- Firestore Rules are deployed explicitly with `npm run deploy:rules`. GitHub Pages CI does not deploy Rules.
- No end-to-end browser automation configuration was found. Manual coverage exists under `Tester/`.
