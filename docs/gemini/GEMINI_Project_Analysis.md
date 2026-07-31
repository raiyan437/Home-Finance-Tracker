# Comprehensive Project Analysis: Home Finance Tracker

## Purpose
This document provides a full-stack architectural, functional, design, and code quality audit of the **Home Finance Tracker** application. It serves as an authoritative reference for current implementation standards, data model relationships, business logic state engines, security boundaries, and future extension points.

---

## Last Updated
**Date**: 2026-07-31  
**Status**: Fully Functional, Production Ready, Zero Compilation Errors (`npx tsc --noEmit` & `npm run build` pass cleanly).

---

## Current Status
- **Core Architecture**: React 19 + TypeScript + Vite 8 + Vanilla CSS Design System with Tailwind-inspired dark/light theme tokens.
- **Financial Arithmetic Engine**: Integer-cent precision model (`amountCents`) enforcing exact cent conservation across split calculations, currency rendering, and debt matrix solutions ($\sum \text{Net} = 0$).
- **Multi-Tenant House Scoping**: Zero data bleed between household sessions (`houseId` binding with strict fallbacks for unassigned users).
- **Offline & Cloud Sync Hybrid**: Instant offline storage via `localStorage` backed by optional real-time Firebase Firestore subscriptions (`expenses`, `settlements`, `cards`).
- **Bilingual Internationalization (EN / BN)**: Complete English and Bengali UI binding with digit formatting (`০-৯`) and localization support.

---

## Relevant Files & Directory Mapping

### Core Application & Context
- [src/App.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/App.tsx): Root container, tab routing, global state synchronization, recurring expense generator engine, modal handlers.
- [src/context/AuthContext.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/context/AuthContext.tsx): Dual authentication provider (Firebase Auth + Mock Local Session DB), user profile switching, house code creation/joining logic.
- [src/types/index.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/types/index.ts): Core TypeScript interfaces (`Expense`, `Settlement`, `PaymentCard`, `House`, `UserProfile`, `Category`, `SplitMethod`).

### Component Tree (`src/components/`)
- [Dashboard.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/Dashboard.tsx): 2-column hero overview layout with net balance cards, minimum cash-flow transfer cards, recent transactions, and visual analytics panel.
- [CategoryPieChart.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/CategoryPieChart.tsx): Interactive SVG Donut Pie Chart displaying proportional category spending with center label metrics and legend.
- [CategoryChart.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/CategoryChart.tsx): Category spending progress bars and multi-segmented out-of-pocket housemate contribution ratio bar.
- [ExpenseList.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/ExpenseList.tsx): Transaction ledger with category/payer filtering, search, pagination, historical card badges, comment threads, and receipt previews.
- [AddExpenseModal.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/AddExpenseModal.tsx): Transaction creation/editing form supporting Equal, Percentage, Exact, and Adjustment splits, card assignment, recurring schedules, and OCR receipt scanning.
- [SettlementView.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/SettlementView.tsx): Debt settlement engine view with pending transfer recommendations, confirmation modal, proof-of-payment image attachments, and reversible settlement history (`[Reversed]` undo button).
- [PersonalWallet.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/PersonalWallet.tsx): Private expense wallet with budget target tracker (৳15,000.00 default), category budget limits, and 80% (amber) / 100% (rose) threshold alert badges.
- [CardsManager.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/CardsManager.tsx): Credit/debit card manager with bank selection, custom card styling, owner assignment, deletion safeguards, and spending statistics.
- [MonthlySummary.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/MonthlySummary.tsx): Historical monthly breakdown, spending comparison cards, category distribution, and CSV report export generator.
- [SettingsView.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/SettingsView.tsx): Profile configuration, house management (create/join house, view invite code), language/theme toggles, and data reset tools.
- [AuthModal.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/AuthModal.tsx): Interactive profile switcher modal and demo account fast-login.
- [LoginPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/LoginPage.tsx) & [SignUpPage.tsx](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/components/SignUpPage.tsx): Dedicated standalone authentication pages with demo account quick buttons.

### Utilities & Engines (`src/utils/`)
- [settlementEngine.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/settlementEngine.ts): Greedy greedy-min-cash-flow algorithm solver, net balance matrix generator (`calculateNetBalances`), and departed member isolation pool handler.
- [currency.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/currency.ts): Bangladeshi Taka (৳) formatting, integer-cent conversion (`dollarsToCents`, `centsToDollars`), input sanitization, and Bengali digit translation (`০-৯`).
- [ocrScanner.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/ocrScanner.ts): Client-side receipt photo analyzer using HTML5 Canvas image contrast adjustments and regex pattern extraction.
- [i18n.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/i18n.ts): Translation dictionary supporting English (`en`) and Bengali (`bn`) keys across all views.
- [storage.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/storage.ts): Safe `localStorage` persistence layer with JSON error handling and data purging helpers.
- [mockAuthDatabase.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/mockAuthDatabase.ts): Mock user profile and house membership database for demo session management.
- [exportCsv.ts](file:///d:/Others/Google%20Antigravity/Home%20Finance/src/utils/exportCsv.ts): Client-side CSV generator with proper formatting and browser download triggers.

---

## Decisions & Rationale

1. **Integer-Cent Arithmetic (`amountCents`)**:
   - *Rationale*: Floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) causes balance drift over time. Storing all monetary amounts in integer cents guarantees mathematical exactness. Remainder cents in split calculations are systematically assigned to the primary payer to satisfy $\sum \text{Shares} = \text{Total}$.

2. **2-Column Responsive Dashboard Layout**:
   - *Rationale*: Pinned explicit desktop grid (`grid-template-columns: minmax(0, 1fr) minmax(0, 420px)`) prevents the visual analytics section from wrapping to the bottom on wide desktop displays ($\ge 992\text{px}$), maintaining an ultra-sleek, balanced workspace.

3. **Reversible Debt Settlements**:
   - *Rationale*: Real-world debt clearing requires auditability and error recovery. By tagging reversed settlements with `status: 'reversed'`, historical records remain intact while net balance calculations ignore reversed amounts.

4. **Departed Member Debt Isolation Ledger**:
   - *Rationale*: When a member leaves a household, deleting their historical transactions breaks accounting history. Isolating their net position under a legacy user pool preserves active housemates' balance equilibrium ($\sum \text{Net}_{\text{active}} = 0$).

5. **Hybrid Storage Strategy**:
   - *Rationale*: Operating with `localStorage` guarantees 100% offline functionality out-of-the-box. When Firebase environment keys are configured, Firestore listeners update state in real-time across connected devices.

---

## Outstanding Work / Next Steps

- [ ] **Multi-Currency Support**: Expand beyond Taka (৳) to support USD ($), EUR (€), and GBP (£) with dynamic exchange rate conversion.
- [ ] **Push Notifications**: Integrate web push notifications for new shared expenses and settlement transfer requests.
- [ ] **Advanced OCR Engine**: Add Tesseract.js WebAssembly integration for complex multi-item receipt itemization.
- [ ] **Export to PDF**: Add PDF invoice/receipt generation in addition to CSV export.

---

## Architecture Notes

```
+-----------------------------------------------------------------------+
|                             React 19 SPA                              |
|  +---------------------+  +--------------------+  +----------------+  |
|  |     AuthContext     |  |   Navigation Tab   |  |   i18n (EN/BN) |  |
|  +----------+----------+  +---------+----------+  +-------+--------+  |
+-------------|-----------------------|---------------------|-----------+
              |                       |                     |
              v                       v                     v
+-----------------------------------------------------------------------+
|                             App Container                             |
|  +--------------------+  +-------------------+  +------------------+  |
|  |     Dashboard      |  |   ExpenseList     |  |  SettlementView  |  |
|  +--------------------+  +-------------------+  +------------------+  |
|  +--------------------+  +-------------------+  +------------------+  |
|  |   PersonalWallet   |  |   CardsManager    |  |  MonthlySummary  |  |
|  +--------------------+  +-------------------+  +------------------+  |
+-------------|-----------------------|---------------------|-----------+
              |                       |                     |
              v                       v                     v
+-----------------------------------------------------------------------+
|                         Business Engine Layer                         |
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

## Constraints & Risks

1. **Local Storage Size Limit**: `localStorage` is capped at ~5MB per domain on browser clients. High-resolution base64 receipt photos attached directly to expenses could exceed limits if stored uncompressed.
   *Mitigation*: OCR scanner compresses receipt photos to max 800px web canvas resolution before encoding.

2. **Unassigned User Isolation**: Unassigned users (without a household code) must not see other unassigned users' private transactions.
   *Mitigation*: Strict `currentHouse` check in `App.tsx` filters `householdExpenses` and `houseSettlements` to `activeUserId` when `currentHouse` is `null`.

---

## Future Considerations
- **Progressive Web App (PWA)**: Register service worker manifest for mobile home screen installation.
- **Biometric Authentication**: Integrate WebAuthn TouchID/FaceID for fast mobile app unlocking.
