# 🚀 Project Handover & AI Agent Onboarding Guide

**Project Name**: Home Finance Tracker  
**Live Production App**: [https://home-finance-tracker-kappa.vercel.app/](https://home-finance-tracker-kappa.vercel.app/)  
**GitHub Repository**: [https://github.com/raiyan437/Home-Finance-Tracker](https://github.com/raiyan437/Home-Finance-Tracker)  
**Last Updated**: 2026-08-02  
**Target Audience**: AI Coding Assistants (Gemini, Claude, Copilot, Codex, GPT) & Human Developers  

---

## 1. Executive Summary & Core Mission

The **Home Finance Tracker** is a production-grade, reactive Single Page Application (SPA) designed for tracking shared household expenses, personal wallets, bank cards, and optimal debt settlements.

### Core Objectives:
1. **Shared Household Expenses**: Multi-member out-of-pocket expense tracking with Equal, Percentage, Exact, and Adjustment splits.
2. **Optimal Debt Simplification**: Solves the minimum cash flow problem to collapse complex multi-party debts into at most $N-1$ direct transfers.
3. **Private Personal Wallet**: Private individual expense logging with monthly budget targets (৳15,000.00 default) and threshold alerts.
4. **Payment Card Manager**: Credit and Debit card tracking with bank names, custom gradients, channel outlays (Cards vs Cash), and card-owner scoping.
5. **Multi-Tenant House Management**: House creation, unique join codes (`HM-XXXX`), roster management, House Leader Gold Crown 👑 privileges, and leadership transfer support.

---

## 2. Non-Negotiable Core Operating Principles

When making any code modifications, **ALWAYS** enforce these rules:

1. **Live App First Priority**: This application is live on Vercel. Any code change must preserve working functionality, backwards compatibility, and live production stability.
2. **Integer Cent Financial Math (`amountCents`)**:
   - **NEVER** use floating-point dollars or Takas for financial arithmetic (`0.1 + 0.2 != 0.3`).
   - Stored in integer cents (`amountCents = 1500` for ৳15.00). Use `formatCurrency(cents, false, lang)` for UI rendering and `dollarsToCents(str)` for form inputs.
3. **Clean HTML5 History Routing**:
   - Uses `window.location.pathname` (`/dashboard`, `/expenses`, `/settlement`, `/personal`, `/cards`, `/monthly`, `/house`, `/settings`).
   - All SPA routes are rewritten to `/index.html` via [vercel.json](file:///d:/Others/Google%20Antigravity/Home%20Finance/vercel.json) to prevent 404s on page refresh.
   - Old hash URLs (`/#/expenses`) automatically clean up to `/expenses`.
4. **Strict Scope Locking**:
   - `scope: 'household'` expenses are managed strictly on the Household Expense page.
   - `scope: 'personal'` expenses are private to the active user on the Personal Wallet page.
5. **Payer-Scoped Bank Card Selection**:
   - In expense creation/editing, users can **only** pick bank cards owned by the selected payer (`card.ownerId === paidBy`).

---

## 3. Technology Stack & Verification Tools

* **Frontend**: React 19, TypeScript, Vite 8 (Rolldown bundler), Vanilla CSS Design System (Midnight Slate theme)
* **Routing**: HTML5 History API (`pushState`, `popstate`) + `vercel.json` SPA rewrites
* **Database & Auth**: Firebase Auth + Cloud Firestore Realtime Listeners (`onSnapshot` WebSockets) with `localStorage` offline fallback
* **Icons**: `lucide-react`
* **Build Verification**:
  ```powershell
  # Windows PowerShell PATH initialization for Node runtime
  $env:PATH = "C:\Users\raiya\AppData\Local\OpenAI\Codex\runtimes\cua_node\fb8898c05a62885e\bin;" + $env:PATH
  
  # Typecheck
  npx tsc --noEmit
  
  # Production Build
  npm run build
  ```

---

## 4. Directory Structure & POM Mapping

```
d:/Others/Google Antigravity/Home Finance/
├── vercel.json                 # Vercel Single-Page Application rewrite rules
├── package.json                # React 19, Vite 8, Firebase 12, Lucide React dependencies
├── docs/                       # Project documentation root
│   ├── Project-Handover.md     # THIS HANDOVER FILE
│   └── gemini/                 # Detailed Gemini Agent specs & logs
│       ├── GEMINI_Architecture.md
│       ├── GEMINI_Project_Analysis.md
│       ├── GEMINI_Project_Flow.md
│       └── GEMINI_Implementation_Log.md
└── src/
    ├── App.tsx                 # Root container, HTML5 routing, recurring bills engine, auth loading guard
    ├── index.css               # Centralized Vanilla CSS design system (tokens, keyframe engines, glassmorphic utility rules)
    ├── components/             # Reusable UI components
    │   ├── Navbar.tsx          # Collapsible sidebar, House Leader Crown 👑 badge, stacked brand header, mobile nav
    │   ├── AddExpenseModal.tsx # Transaction modal, split calculator, payer-scoped card selector, receipt preview
    │   ├── CategoryPieChart.tsx# Responsive SVG Donut Chart with centered label metrics and legend
    │   ├── CategoryChart.tsx   # Category progress bars and out-of-pocket housemate contribution ratio bar
    │   ├── LoadingSpinner.tsx  # Titanium dual-ring loading spinner component
    │   ├── UserAvatar.tsx      # Avatar badge supporting base64, URLs, and HSL gradient initials
    │   ├── ConfirmModal.tsx    # Universal confirmation modal
    │   └── ErrorBoundary.tsx   # Universal React error recovery boundary
    ├── context/
    │   └── AuthContext.tsx     # Firebase Auth + Firestore user profile & house roster sync, leadership transfer
    ├── features/               # Isolated domain logic engines
    │   ├── settlementEngine.ts # Integer cent math, greedy minimum cash flow solver (N^2 -> N-1 transfers)
    │   ├── exportCsv.ts        # Client-side CSV report generator
    │   └── ocrScanner.ts       # HTML5 Canvas receipt photo OCR parser
    ├── pages/                  # Top-level view pages
    │   ├── DashboardPage.tsx   # 2-column hero overview, net balances, all-time & monthly metrics, debt action cards
    │   ├── ExpenseListPage.tsx # Transaction ledger, category/payer filters, search, New-to-Old / Old-to-New sort selector
    │   ├── SettlementPage.tsx  # Debt settlement minimizer, proof image attachments, recipient-only confirmation guard
    │   ├── PersonalWalletPage.tsx# Private expense tracker, budget target bar (৳15,000 default), category budget limits
    │   ├── CardsPage.tsx       # Credit/debit card manager, gradient styling, strict owner isolation
    │   ├── MonthlyPage.tsx     # Month-scoped report breakdown, comparison stats, CSV export
    │   ├── HousePage.tsx       # House management, invitation code (HM-XXXX), leadership transfer control, roster table
    │   ├── SettingsPage.tsx    # Profile configuration, password verification, theme/language toggles, data reset
    │   ├── LoginPage.tsx & SignUpPage.tsx # Standalone authentication views
    │   └── NotFoundPage.tsx    # Clean 404 error page with dashboard return CTA
    ├── services/               # Data persistence layer
    │   ├── firebaseSync.ts     # Cloud Firestore realtime WebSocket snapshot listeners & sanitizers
    │   ├── storage.ts          # LocalStorage offline fallback & export/import persistence
    │   └── mockAuthDatabase.ts # Session database drivers
    ├── types/
    │   └── index.ts            # Strongly typed contracts (Expense, Settlement, PaymentCard, House, UserProfile)
    └── utils/
        ├── currency.ts         # Integer cent / Taka (৳) conversion & formatting helpers
        ├── i18n.ts             # English & Bengali (bn-BD) localization strings
        ├── notifications.ts    # Browser notification triggers
        └── share.ts            # Web Share API & clipboard helper
```

---

## 5. Critical Business Engines & Algorithms

### A. Minimum Cash Flow Debt Minimizer (`src/features/settlementEngine.ts`)
1. Calculates net balance for every housemate:
   $$\text{Net Balance}_u = \sum \text{Paid By } u - \sum \text{Shares of } u + \sum \text{Settlements Paid By } u - \sum \text{Settlements Received By } u$$
2. Maintains priority queues for `Creditors` ($\text{Net} > 0$) and `Debtors` ($\text{Net} < 0$).
3. Solves greedily: $\text{transfer} = \min(-D.\text{balance}, C.\text{balance})$, resulting in at most $N-1$ direct transfers.

### B. Expense List Sorting Order (`src/pages/ExpenseListPage.tsx`)
1. Expenses default to **New to Old** (`sortOrder = 'newest'`).
2. Uses multi-tier sorting: `date` (YYYY-MM-DD) $\rightarrow$ `createdAt` timestamp $\rightarrow$ `ID` string.
3. User can toggle to **Old to New** via the filter bar dropdown.

### C. Initial Auth Loading Guard (`src/context/AuthContext.tsx` & `src/App.tsx`)
1. `loading` starts as `true` on initial page load.
2. Displays a full-screen `<LoadingSpinner message="Authenticating session..." fullScreen />` until Firebase Auth and Firestore snapshots resolve.
3. Completely prevents flashing mock user data (`Raiyan` / default placeholder avatar) on page refresh.

---

## 6. Development & Deployment Cheatsheet

### How to Run Locally:
```powershell
$env:PATH = "C:\Users\raiya\AppData\Local\OpenAI\Codex\runtimes\cua_node\fb8898c05a62885e\bin;" + $env:PATH
npm run dev
```

### How to Verify Changes Before Pushing:
```powershell
npx tsc --noEmit
npm run build
```

### How to Push to Live App:
```powershell
git add .
git commit -m "feat: your concise feature description"
git push origin main
```
*Note: Vercel automatically deploys every commit pushed to `main`.*

---

## 7. Outstanding Extension Points / Future Roadmap

1. **Modularize `AuthContext.tsx`**: Extract house-specific state (`currentHouse`, `createHouse`, `transferLeadership`) into a dedicated `HouseContext` or `useHouse` hook.
2. **Client-Side Tesseract.js OCR**: Upgrade `ocrScanner.ts` to full Tesseract worker parsing for auto-filling total prices directly from uploaded receipt photos.
3. **Printable PDF Export**: Add PDF monthly statement download alongside CSV export.
4. **FCM Push Notifications**: Register Firebase Cloud Messaging Service Worker for background push notifications on debt settlements.

---

*This document is verified up to date as of August 2, 2026. The new AI Agent can start developing immediately using these specifications.*
