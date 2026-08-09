# AI project memory

Last verified: 2026-08-09 against commit `65a77a1` and the working tree. Reverify changed areas before relying on this file.

## Verified facts

- The repository is `raiyan437/Home-Finance-Tracker`; the package is private and named `home-finance`.
- It is a client-rendered household finance SPA built with React, TypeScript, Vite, and vanilla CSS.
- Core product areas are authentication/profile management, households, shared and personal expenses, payment cards, monthly reporting, recurring expenses, receipt OCR, comments, and settlement calculation/confirmation/reversal.
- Monetary domain values use integer cent/poisha fields such as `amountCents` in the typed model and financial engines.
- Browser routes are implemented directly with the History API. Valid application paths are `/dashboard`, `/expenses`, `/settlement`, `/personal`, `/cards`, `/monthly`, `/house`, and `/settings`.
- Firebase integrations include Authentication, Cloud Firestore, Cloud Storage, and callable Cloud Functions. Scoped LocalStorage caches and an outbox provide local/offline behavior.
- Frontend runtime dependencies are Firebase, React/React DOM, Lucide React, and Tesseract.js. The separate `functions/` package uses Firebase Admin and Firebase Functions on Node 20.
- The repository is currently on `main`, tracking `origin/main`. Pushes and pull requests to `main` run the GitHub Pages workflow.

## Verified constraints and conventions

- Preserve integer-based financial calculations and zero-sum ledger validation.
- Keep household and personal data scoped separately by house and user.
- Treat Firebase rules and callable functions as authorization/integrity boundaries, not merely UI validation.
- Maintain HTML5 route fallback behavior when changing hosting or routing.
- Do not expose `.env` values or other sensitive local data. `.env.example` documents required `VITE_FIREBASE_*` variables.
- Do not edit generated `dist/` output or dependency directories as source.

## Authoritative evidence

- Product/setup overview: `README.md`.
- Frontend dependencies and scripts: `package.json` and `package-lock.json`.
- Function dependencies and scripts: `functions/package.json` and `functions/package-lock.json`.
- Runtime composition: `src/main.tsx`, `src/App.tsx`, and `src/context/AuthContext.tsx`.
- Domain contracts and rules: `src/types/index.ts` and `src/features/`.
- Persistence/integration: `src/services/`, `src/config/firebase.ts`, `firestore.rules`, `storage.rules`, and `functions/index.js`.
- Build/deploy: `vite.config.ts`, `vercel.json`, `firebase.json`, and `.github/workflows/deploy.yml`.
- Tests: colocated `*.test.ts`, `functions/*.test.js`, `tests/rules/*.test.ts`, and `Tester/`.

## Existing documentation

- `docs/Project-Handover.md` is a broad onboarding snapshot.
- `docs/Phase-2-Sync-Flow.md`, `docs/Phase-3-Financial-Model.md`, and `docs/Phase-4-Lifecycle.md` describe later implementation phases.
- `docs/gemini/` contains agent-specific historical analysis and implementation records.
- `Tester/` contains manual feature-verification guidance.
- These files are preserved. When they conflict with code or current configuration, source/configuration wins and the conflict should be recorded rather than silently copied.

## Documentation conflicts found

- `README.md` describes GitHub Pages as the CI deployment target and also says Vercel auto-deploys. `docs/Project-Handover.md` identifies Vercel as the live production app. Both `vercel.json` and a GitHub Pages deployment workflow exist. The currently authoritative public deployment target is **NEEDS VERIFICATION**.
- Several historical Gemini documents describe earlier filenames, gaps, or proposals that no longer match the current source. They must not be treated as current implementation facts without verification.
- Some existing Markdown text renders with mojibake in the inspected Windows console. Whether the files are incorrectly encoded or only displayed with the wrong console encoding is **NEEDS VERIFICATION**.

## Unknown or not assessed

- Production Firebase project health, deployed rules/functions versions, and current production data shape: **NOT ASSESSED**.
- Vercel project linkage and whether Vercel currently deploys `main`: **NEEDS VERIFICATION**.
- Browser support matrix, accessibility audit status, performance budgets, and production observability: **NOT ASSESSED**.
- Backup/restore operational ownership and disaster-recovery procedure: **NOT ASSESSED**.
- No repository license was observed during initialization: **NEEDS VERIFICATION** if distribution terms matter.
