# Comprehensive Project Analysis: Home Finance Tracker

## Purpose
This document provides a full-stack architectural, functional, design, Vercel live deployment, and code quality audit of the **Home Finance Tracker** application. It serves as an authoritative reference for current implementation standards, Page-Object Model (POM) directory structure, data model relationships, business logic state engines, security boundaries, live Vercel application behavior, and future extension points.

---

## Last Updated
**Date**: 2026-08-01  
**Status**: Fully Functional, Production Ready, Live on Vercel & GitHub Pages (`npx tsc -b` & `npm run build` pass cleanly).

---

## Current Live Status & Live App First Principles

- **Live Deployment Hosting**: Active Production Deployment on **Vercel** and **GitHub Pages**.
- **Live App Priority Rule**: All architecture decisions, routing, asset references (`base: './'`), data persistence, and Firebase Firestore subscriptions are optimized **live-app-first**.
- **SPA Routing Architecture**: Hash-based client routing (`#dashboard`, `#expenses`, `#settlement`, `#personal`, `#cards`, `#monthly`, `#house`, `#settings`) combined with Vercel single-page application rewrites ([vercel.json](file:///d:/Others/Google%20Antigravity/Home%20Finance/vercel.json)) ensures zero 404 page refreshes on live Vercel deployments.
- **Core Architecture**: React 19 + TypeScript + Vite 8 (Rolldown bundler) + Vanilla CSS Design System with Midnight Slate dark/light theme tokens and dynamic micro-animations.
- **Financial Arithmetic Engine**: Integer-cent precision model (`amountCents`) enforcing exact cent conservation across split calculations, currency rendering, and debt matrix solutions ($\sum \text{Net} = 0$).
- **Multi-Tenant House Scoping**: Zero data bleed between household sessions (`houseId` binding with strict fallbacks for unassigned users).
- **Offline & Cloud Sync Hybrid**: Instant local storage via `localStorage` backed by optional real-time Firebase Firestore subscriptions (`expenses`, `settlements`, `cards`, `houses`).
- **Bilingual Internationalization (EN / BN)**: Complete English and Bengali UI binding with digit formatting (`০-৯`) and localization support.

---

## Page-Object Model (POM) Directory Mapping

### Core Application & Context
- [src/App.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/App.tsx): Root container, hash routing, global state synchronization, recurring expense generator engine, modal handlers.
- [src/context/AuthContext.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/context/AuthContext.tsx): Dual authentication provider (Firebase Auth + Mock Local Session DB), user profile switching, house code creation/joining logic, real-time house member subscriptions.
- [src/types/index.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/types/index.ts): Core TypeScript interfaces (`Expense`, `Settlement`, `PaymentCard`, `House`, `UserProfile`, `Category`, `SplitMethod`).

### Pages (`src/pages/`)
- [DashboardPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/DashboardPage.tsx): 2-column hero overview layout with net balance cards, minimum cash-flow transfer cards, recent transactions, and left-column visual analytics panels.
- [ExpenseListPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/ExpenseListPage.tsx): Transaction ledger with category/payer filtering, search, pagination, historical card badges, vertical metadata stacking, comment threads, and receipt previews.
- [SettlementPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/SettlementPage.tsx): Debt settlement engine view with recipient-only confirmation authorization, proof-of-payment image attachments, confirmation modals, and reversible settlement history (`[Reversed]` undo button).
- [PersonalWalletPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/PersonalWalletPage.tsx): Private expense wallet with budget target tracker (৳15,000.00 default), category budget limits, and 80% (amber) / 100% (rose) threshold alert badges.
- [CardsPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/CardsPage.tsx): Credit/debit card manager with bank selection, custom card styling, strict owner isolation, deletion safeguards, and spending statistics.
- [MonthlyPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/MonthlyPage.tsx): Month-scoped historical breakdown, spending comparison cards, period-isolated settlement reporting, and CSV/PDF report generators.
- [HousePage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/HousePage.tsx): Multi-user household management view with house code copying/sharing, inline house name editing, join input validation (`HM-XXXX`), member balance guards, and roster table.
- [SettingsPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/SettingsPage.tsx): Profile configuration, custom avatar upload, current password verification & change, environment badge, language/theme toggles, JSON backup/restore tools, and data reset tools.
- [LoginPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/LoginPage.tsx) & [SignUpPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/pages/SignUpPage.tsx): Dedicated standalone authentication pages with open public registration and email validation.

### Components (`src/components/`)
- [Navbar.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/Navbar.tsx): Dark charcoal sidebar navigation with titanium active indicator, category groupings, dynamic avatar initials badge, and language toggle.
- [AddExpenseModal.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/AddExpenseModal.tsx): Transaction creation/editing form supporting Equal, Percentage, Exact, and Adjustment splits, leader-only payer reattribution rule, card assignment, recurring schedules, and OCR receipt scanning.
- [CategoryPieChart.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/CategoryPieChart.tsx): Interactive SVG Donut Pie Chart displaying proportional category spending with center label metrics and legend.
- [CategoryChart.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/CategoryChart.tsx): Category spending progress bars and multi-segmented out-of-pocket housemate contribution ratio bar.
- [ConfirmModal.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/ConfirmModal.tsx) & [ErrorBoundary.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/ErrorBoundary.tsx): Universal confirmation dialog and error recovery boundary.
- [UserAvatar.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/UserAvatar.tsx): Reusable avatar badge supporting base64 profile pictures, external URLs, and dynamic HSL gradient initials fallbacks.
- [LiquidMetalButton.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/LiquidMetalButton.tsx): Modern CTA button with rotating liquid rainbow neon border hover effects.

### Services Layer (`src/services/`)
- [firebaseSync.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/services/firebaseSync.ts): Real-time Cloud Firestore snapshot listeners, recursive `sanitizeForFirestore` undefined value stripper, and scoping drivers for expenses, settlements, cards, and house rosters.
- [storage.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/services/storage.ts): Safe `localStorage` persistence layer with JSON error handling, password sanitization on backup exports, and data purging helpers.
- [mockAuthDatabase.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/services/mockAuthDatabase.ts): User profile and house membership database drivers for local authentication sessions.

### Features & Business Engines (`src/features/`)
- [settlementEngine.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/features/settlementEngine.ts): Greedy min-cash-flow algorithm solver, net balance matrix generator (`calculateNetBalances`), and departed member debt isolation pool handler.
- [ocrScanner.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/features/ocrScanner.ts): Client-side receipt photo analyzer using HTML5 Canvas image contrast adjustments and regex pattern extraction.
- [exportCsv.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/features/exportCsv.ts): Client-side CSV generator with proper formatting and browser download triggers.

---

## Key Business Logic & Authorization Safeguards

1. **Integer-Cent Arithmetic (`amountCents`)**:
   - Monies are tracked in integer cents to eliminate floating-point drift (`0.1 + 0.2`). Remainder cents are allocated deterministically to the primary payer.

2. **Leader & Authorization Controls**:
   - **Expense Modification**: locked to expense creator (`paidBy === myUid`) or House Leader.
   - **Payer Reattribution in Add Expense Modal**: regular members are locked to their own UID; House Leader can assign out-of-pocket payment to any member.
   - **Settlement Reversal**: locked to payment recipient (`toUserId === myUid`) or House Leader.
   - **Audit Data Clearance**: locked to House Leader with confirmation modal protection.
   - **Leaving Household Guard**: members with non-zero net balances ($\text{Net} \ne 0$) are blocked from leaving until all settlements are cleared.

3. **Vercel & Live App Infrastructure**:
   - [vercel.json](file:///d:/Others/Google%20Antigravity/Home%20Finance/vercel.json) rewrites all incoming routes to `/index.html` for clean SPA URL support.
   - Asset URLs use relative paths (`base: './'`) in [vite.config.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/vite.config.ts) for universal CDN / Vercel edge deployment compatibility.

---

## Live System Architecture

```
+-----------------------------------------------------------------------+
|                    Live Vercel & GitHub Pages Deployment              |
|  +---------------------+  +--------------------+  +----------------+  |
|  |     AuthContext     |  |  Hash Routing SPA  |  |   i18n (EN/BN) |  |
|  +----------+----------+  +---------+----------+  +-------+--------+  |
+-------------|-----------------------|---------------------|-----------+
              |                       |                     |
              v                       v                     v
+-----------------------------------------------------------------------+
|                           Page Views Layer                            |
|  +--------------------+  +-------------------+  +------------------+  |
|  |   DashboardPage    |  |  ExpenseListPage  |  |  SettlementPage  |  |
|  +--------------------+  +-------------------+  +------------------+  |
|  +--------------------+  +-------------------+  +------------------+  |
|  | PersonalWalletPage |  |     CardsPage     |  |   MonthlyPage    |  |
|  +--------------------+  +-------------------+  +------------------+  |
|  +--------------------+  +-------------------+  +------------------+  |
|  |     HousePage      |  |   SettingsPage    |  | LoginPage/SignUp |  |
|  +--------------------+  +-------------------+  +------------------+  |
+-------------|-----------------------|---------------------|-----------+
              |                       |                     |
              v                       v                     v
+-----------------------------------------------------------------------+
|                         Feature Engines Layer                         |
|  +---------------------+  +-------------------+  +-----------------+  |
|  |  settlementEngine   |  |     currency      |  |   ocrScanner    |  |
|  +---------------------+  +-------------------+  +-----------------+  |
+-------------|-----------------------|---------------------|-----------+
              |                       |                     |
              v                       v                     v
+-----------------------------------------------------------------------+
|                          Data Storage Layer                           |
|  +---------------------+                       +-------------------+  |
|  |    localStorage     |<=====================>| Firebase Firestore |  |
|  +---------------------+                       +-------------------+  |
+-----------------------------------------------------------------------+
```

---

## Verification & Deployment Guidelines

- **Typecheck Command**: `npx tsc -b` (must pass with 0 errors).
- **Build Command**: `npm run build` (generates production bundle in `dist/`).
- **Live Deployment Trigger**: Pushing to `main` branch deploys live to GitHub Pages via Actions and automatically triggers Vercel continuous deployment.
