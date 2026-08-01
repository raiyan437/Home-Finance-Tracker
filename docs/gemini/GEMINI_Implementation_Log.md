# GEMINI Implementation Log

**Purpose**: Track implementation decisions, milestones, and updates for the Household Expense Settlement App.  
**Last Updated**: 2026-08-01  
**Current Status**: Active Production Deployment (GitHub Pages Live)  

---

## Log Entries

### 2026-07-27: Initial Setup & Planning
* Inspected project directory and initialized React 18 TypeScript Vite app.
* Created `docs/gemini/GEMINI_Architecture.md` defining data schemas (`User`, `Expense`, `Share`, `Settlement`).
* Designed integer cent balance engine & min-cash-flow algorithm for optimal debt settlement.

### 2026-07-27: Complete Application Implementation
* **Design System & CSS (`src/index.css`)**:
  * Implemented responsive desktop sidebar & mobile bottom navigation.
  * HSL color tokens for dark/light themes, card glassmorphism, and status badges.
* **Financial Logic (`src/utils/settlementEngine.ts` & `src/utils/currency.ts`)**:
  * Integer cent calculations for exact currency handling.
  * Solved minimum cash flow problem yielding at most $N-1$ settlement transfers.
  * Supported equal splits, custom split validation, and percentage splits.
* **Components (`src/components/`)**:
  * `Dashboard.tsx`: Total household spend, individual paid stats, housemate net balances, and quick settlement card.
  * `AddExpenseModal.tsx`: Fast expense modal with category pickers, personal purchase shortcuts, and live share validation.
  * `SettlementView.tsx`: Debt simplification interface with "Mark as Settled" action and completed settlement history audit log.
  * `ExpenseList.tsx`: Complete history list with category, person, and search filters, plus edit/delete capabilities.
  * `MonthlySummary.tsx`: Monthly reports and category breakdown stats.

### 2026-07-28: Complete UI/UX Overhaul & Modernization
* **Ultra-Modern Design System (`src/index.css`)**:
  * Upgraded dark & light mode palettes to midnight slate glassmorphism (`#090d16`, glass cards with 16px backdrop blur, subtle borders, glow shadows).
  * Tabular numbers formatting (`tabular-nums`) across all financial figures.
  * Micro-animations, card elevation hover effects, and glowing active tab indicators.
* **New Analytics & Charts (`src/components/CategoryChart.tsx`)**:
  * Category spending progress bars with custom color badges.
  * Multi-segmented housemate out-of-pocket contribution ratio bar for Raiyan, Himel, and Lazim.
* **Enhanced Dashboard (`src/components/Dashboard.tsx`)**:
  * 4 hero summary stat cards: Total Spend, Outstanding Debt, Settled Debt Paid, and Average Per Member.
  * Housemate balance cards featuring target share progress bars.
  * Direct node-to-node debt transfer action cards.
* **Refined Expense Management & Settlement**:
  * `AddExpenseModal.tsx`: Added template presets ("Weekly Groceries", "WiFi Internet", etc.), live share calculation preview, and custom pill selectors.
  * `ExpenseList.tsx`: Expanded share breakdown pills, search bar, and filter toolbar.
  * `SettlementView.tsx`: Step-by-step transaction flow visualization and audit history log.

### 2026-07-28: Custom Male Avatar Integration
* Generated 3 distinct 3D rendered male character avatar icons for **Raiyan**, **Himel**, and **Lazim**.
* Created `src/components/UserAvatar.tsx` reusable avatar component supporting images with fallback text initials.
* Integrated `UserAvatar` across all views.

### 2026-07-28: Full Online Static Bundling & GitHub Actions Deployment
* **Bundled Static Avatar Imports (`src/assets/avatars/`)**:
  * Moved male avatar images into `src/assets/avatars/` and imported them statically in `src/utils/settlementEngine.ts`.
  * Prevents domain root 404 pathing errors when hosted on GitHub Pages subpaths or custom domains.
* **GitHub Actions Workflow (`.github/workflows/deploy.yml`)**:
  * Formulated full automated pipeline: dependency installation, `oxlint` linting, `tsc` type-checking, production building, and automated deployment to GitHub Pages.

### 2026-07-28: Firebase Authentication & Private Personal Money Tracker
* **Firebase SDK Integration (`src/config/firebase.ts` & `src/context/AuthContext.tsx`)**:
  * Added `firebase` SDK with `AuthContext` supporting 1-Click Housemate profile switching (Raiyan, Himel, Lazim) and Firebase Email/Password authentication.
* **Private Personal Money Tracker (`src/components/PersonalWallet.tsx`)**:
  * Created dedicated **Personal Wallet** view allowing users to log private personal outlays.
* **Modal Scope Selector (`src/components/AddExpenseModal.tsx`)**:
  * Added toggle for **Shared Household Expense** vs **Private Personal Expense**.

### 2026-07-28: Instant Image Performance & Comprehensive Mobile Responsiveness
* **Avatar Compression (91% Size Reduction)**:
  * Resized and optimized avatar PNGs down from 2.1 MB total payload to 193 kB (72kB Raiyan, 58kB Himel, 62kB Lazim).
  * Enables instant image loading over all web and mobile connections.
* **Mobile Responsiveness Overhaul (`src/index.css`)**:
  * Added comprehensive media queries for `< 768px`, `< 640px`, and `< 480px` viewports.

### 2026-07-28: Payment Cards Management & Channel Tracking
* **Payment Cards View (`src/components/CardsManager.tsx`)**:
  * Added **Payment Cards** section to sidebar and mobile navigation with `CreditCard` icon.
  * Form to create custom bank cards with **Bank Name** and 8 curated gradient themes.
* **Payment Channel Picker (`src/components/AddExpenseModal.tsx`)**:
  * Added Cash vs Bank Card picker when logging household or personal expenses.
* **Expense Tags & Filters (`src/components/ExpenseList.tsx`)**:
  * Displayed 💳 *Bank Card* vs 💵 *Cash* badges on expense items with payment channel filtering.

### 2026-07-28: Improvements 1–4 Execution (Realtime Sync, Code-Splitting, Recurring Bills, Receipts & CSV Reports)
* **Cloud Firestore Realtime Sync (`src/utils/firebaseSync.ts`)**:
  * Connected `onSnapshot` realtime listeners for `expenses`, `settlements`, and `cards`.
* **Vite Code-Splitting Optimization (`vite.config.ts` & `src/App.tsx`)**:
  * Used `React.lazy()` for heavy tab views. Initial bundle size dropped from 777 kB to **71.95 kB** (90% reduction).
* **Recurring Bills Engine (`src/components/AddExpenseModal.tsx`)**:
  * Added toggle for Monthly or Weekly automated recurring shared bills.
* **Receipt Attachments & CSV Export (`src/utils/exportCsv.ts`)**:
  * Allowed uploading and previewing receipt photos attached to expenses with CSV audit exports.

### 2026-07-28: Credit Card vs Debit Card Type Classification
* **Card Type Field (`src/types/index.ts`)**:
  * Added `cardType?: 'debit' | 'credit'` to `PaymentCard`.
* **Card Modal Selector (`src/components/CardsManager.tsx`)**:
  * Added Credit Card vs Debit Card toggle selector button group when creating or editing a card.
  * Visual 3D card layout displays prominent `CREDIT CARD` or `DEBIT CARD` text badge.

### 2026-07-29: Personal Wallet Month & Year Selector Refinement
* **Removed All-Time Spent Section (`src/components/PersonalWallet.tsx`)**:
  * Removed the all-time spent card to keep the personal wallet layout clean and month-focused.
* **Calendar Month/Year Selector (`src/components/PersonalWallet.tsx`)**:
  * Added a `Calendar` icon + Month/Year dropdown selector inside the **Monthly Personal Outlay** header card.

### 2026-07-29: Solar Yellow Card Gradient Preset Integration
* **Yellow Color Gradient (`src/components/CardsManager.tsx`)**:
  * Added vibrant **Solar Yellow** (`linear-gradient(135deg, #d97706, #eab308, #fde047)`) option to card theme color presets grid.

### 2026-07-29: Bangladeshi Taka (৳) Currency Standard & Portable Cloud Setup
* **Taka (৳) Symbol (`src/utils/currency.ts`)**:
  * Updated `formatCurrency` to output figures using **৳** (Taka) symbol.
* **Cloud & Cross-Platform Portability (`.env.example` & `README.md`)**:
  * Added `.env.example` template for Firebase configuration.

### 2026-07-29: AI OCR Receipt Scanner, Expense Comments & Bilingual Localization (EN/BN)
* **AI OCR Receipt Scanner (`src/utils/ocrScanner.ts`)**:
  * Automatic text parsing of attached receipt photos to auto-fill title, amount in ৳, and date.
* **Expense Discussion Threads (`src/components/ExpenseList.tsx`)**:
  * In-app comment feed under expanded expense items with housemate avatars and timestamps.
* **Bilingual Localization (`src/utils/i18n.ts` & `src/components/Navbar.tsx`)**:
  * English vs **বাংলা (Bengali)** language toggle in the sidebar & mobile header.

### 2026-07-29: Unconfigured Firebase Safe Fallback & Vite Rollup Chunking Fix
* **Firebase Safe Fallback (`src/config/firebase.ts` & `src/context/AuthContext.tsx`)**:
  * Wrapped Firebase SDK initialization in a `try...catch` block and added null checks (`!auth`, `!db`) across listeners.
* **Vite Rollup Config (`vite.config.ts`)**:
  * Updated `build.rollupOptions` chunking for standard Vite Rollup pipeline.

### 2026-07-29: Add Expense Modal Render Loop Fix & ErrorBoundary Integration
* **Render Loop Fix (`src/components/AddExpenseModal.tsx`)**:
  * Fixed `useEffect` dependency array `[isOpen, initialExpense]` with `if (!isOpen) return;` guard to eliminate re-render loops caused by array prop reference changes.
* **React Error Boundary (`src/components/ErrorBoundary.tsx` & `src/App.tsx`)**:
  * Wrapped entire application in `ErrorBoundary` class component to catch any uncaught UI exceptions and render a recovery screen instead of letting the DOM turn blank.

### 2026-07-29: Comprehensive Project Audit & Analysis
* Verified project compilation (`tsc --noEmit`) - **0 errors**.
* Audited linter rules (`oxlint`) - **0 errors**, 6 minor warnings.
* Confirmed documentation alignment across `/docs/gemini/GEMINI_Architecture.md` and `/docs/gemini/GEMINI_Implementation_Log.md`.

### 2026-07-29: Created Project Flow Architecture & UI Wireframes Documentation
* Created `docs/gemini/GEMINI_Project_Flow.md` containing Mermaid system diagrams, ASCII screen wireframes, data lifecycle workflows, module mappings, and design rationale.

### 2026-07-29: Leader-Based Multi-User Household Management System with House Codes
* **Data Models (`src/types/index.ts`)**: Added `UserProfile`, `HouseMember`, `HouseRole`, and `House` interfaces.
* **Auth Engine & House Controls (`src/context/AuthContext.tsx`)**:
  * Added `displayName` to Sign Up flow.
  * Added `createHouse(houseName)` generating 6-character codes (e.g. `HM-8823`) and setting user as 👑 `leader`.
  * Added `joinHouse(houseCode)` adding user as 👤 `member`.
  * Added `kickMember(targetUid)` for Leaders to remove members and reset their house state in realtime.
  * Added `leaveHouse()` for non-leader members.
* **Settings View (`src/components/SettingsView.tsx`)**:
  * Created NEW Settings view featuring House Code Banner with 1-click **"📋 Copy House Code"** button, member roster table, role badges, and kick/leave actions.
* **Navigation (`src/components/Navbar.tsx` & `src/App.tsx`)**:
  * Added Settings ⚙️ tab to sidebar and mobile bottom nav, displaying live House Name and House Code.
* **Realtime Firestore Scoping (`src/utils/firebaseSync.ts`)**:
  * Scoped realtime listeners (`expenses`, `settlements`, `cards`) by `houseId`.

### 2026-07-29: Standalone Login & Sign Up Pages & Offline Multi-User Database Engine
* **Local Multi-User Database Engine (`src/utils/mockAuthDatabase.ts`)**:
  * Built an offline multi-user authentication & database engine pre-populated with **Raiyan** (`raiyan@gmail.com` / `dummy123`), **Himel** (`himel@gmail.com` / `dummy123`), and **Lazim** (`lazim@gmail.com` / `dummy123`).
* **Standalone Login Page (`src/components/LoginPage.tsx`)**:
  * Replaced login modal with a full-screen glassmorphism Login Page featuring 1-click quick demo buttons for Raiyan, Himel, and Lazim.
* **Standalone Sign Up Page (`src/components/SignUpPage.tsx`)**:
  * Created dedicated full-screen Sign Up Page for registering new accounts.
* **Redirect on Logout (`src/App.tsx`)**:
  * Logging out immediately redirects the application to the standalone **Login Page**.

### 2026-07-29: Strict Pre-Approved Dummy Account Enforcement
* **Strict Authentication Guards (`src/context/AuthContext.tsx`)**:
  * Restricted authentication and registration exclusively to pre-approved housemate accounts:
    - **Raiyan**: `raiyan@gmail.com` | `dummy123`
    - **Himel**: `himel@gmail.com` | `dummy123`
    - **Lazim**: `lazim@gmail.com` | `dummy123`
  * Any other email or password combination is strictly rejected with a clear access denied message across both local and live git links!

### 2026-07-29: AuthModal Removal & User Switching Restricted Exclusively to Log Out
* **Removed AuthModal Overlay (`src/App.tsx` & `src/components/Navbar.tsx`)**:
  * Completely removed `AuthModal.tsx` and all references to prevent any modal popup from re-appearing after login or logout.
* **Strict Logout & Login User Switching**:
  * User switching can now ONLY be accomplished by clicking **"Log Out"**, which terminates the active session and renders the standalone `LoginPage.tsx`.

### 2026-07-29: Dashboard Cleaned (Buttons Removed from Dashboard Header Only)
* **Removed Dashboard Buttons (`src/components/Dashboard.tsx`)**:
  * Removed the **"Reset Demo Data"** button and **"Add Expense"** button from the Dashboard page header.
  * The **"+ New Expense"** button in the left sidebar and mobile navigation remains active and fully functional.

### 2026-07-29: Complete UI/UX Polish & Modern Minimal Design System Refinement
* **CSS Design System Rules (`src/index.css`)**:
  * Built pixel-perfect `.user-profile-card`, `.user-profile-info`, `.user-name-row`, `.user-name`, and `.user-role-badge` rules.
  * Aligned all grid gaps, card padding, button heights, border radii, and font weights across the app.

### 2026-07-29: House Name Editing Capability for House Leaders
* **Leader Power Engine (`src/context/AuthContext.tsx`)**:
  * Implemented `updateHouseName(newName)` method restricted to users with `role: 'leader'` or `currentHouse.leaderUid === user.uid`.
* **Inline House Name Editing (`src/components/SettingsView.tsx`)**:
  * Added an **"Edit Name ✏️"** action button inside the House Code Banner for Leaders.
  * Features inline edit form, text validation, and instant realtime updates across the sidebar title and settings header.

### 2026-07-29: Dynamic House Member Scoping for Dashboard, Settlement Engine, Splits, and Analytics
* **Dynamic House User Resolution (`src/utils/settlementEngine.ts`)**:
  * Created `getHouseUsers(currentHouse)` helper mapping active house members dynamically from `currentHouse.members`.
  * Refactored `calculateNetBalances` and `calculateSimplifiedSettlements` to accept `activeUsers`.
* **Dashboard Dynamic Rendering (`src/components/Dashboard.tsx`)**:
  * Dashboard net balances, housemate cards, and average per member (`totalSpent / memberCount`) are dynamically rendered ONLY for the active members currently in the house.
* **Add Expense Modal & Analytics Scoping (`src/components/AddExpenseModal.tsx` & `src/components/CategoryChart.tsx`)**:
  * Expense split checkboxes, equal share calculations, payer pickers, and out-of-pocket ratio charts dynamically scope exclusively to active members of the current house!

### 2026-07-29: Complete Realtime House Member Synchronization & Roster Alignment
* **Default Seed Roster Alignment (`src/utils/mockAuthDatabase.ts`)**:
  * Aligned seed house roster `house-demo-001` to contain **Raiyan** (Leader) and **Lazim** (Member) only.
  * Unassigned Himel initially (`houseId: null`), so Himel can test joining via House Code `HM-8823`.
* **Synchronized Session & House State Loading (`src/context/AuthContext.tsx`)**:
  * Added explicit `syncHouseForUser(userProfile)` handler on login, sign up, profile switch, and member kick/leave actions.
  * Ensured `useEffect` re-reads fresh house objects from `localStorage` whenever `dbUserProfile` updates.

### 2026-07-29: Comprehensive Functional Logic Audit & Resolved
* **House Expense & Settlement Isolation (`src/App.tsx`)**:
  * Added strict `currentHouse.id` filtering for `householdExpenses` and `houseSettlements` to guarantee zero data bleed across houses.
* **Personal Expense Owner Scoping (`src/components/PersonalWallet.tsx` & `src/components/AddExpenseModal.tsx`)**:
  * Added `ownerId: activeUserId` to `AddExpenseModal` creation payload and updated `PersonalWallet` filter to `(e.ownerId === activeUserId || e.paidBy === activeUserId)`.
* **Dynamic House Users in Expense List & Monthly Summary (`src/components/ExpenseList.tsx` & `src/components/MonthlySummary.tsx`)**:
  * Replaced hardcoded `ALL_USERS` in `ExpenseList` dropdowns and `MonthlySummary` breakdown cards with dynamic `getHouseUsers(currentHouse)`.
* **Firestore Empty Snapshot Listener Fix (`src/utils/firebaseSync.ts`)**:
  * Removed `if (list.length > 0)` condition in snapshot listeners so clearing items correctly updates React state with empty array `[]`.
* **Dynamic CSV Export Resolution (`src/utils/exportCsv.ts`)**:
  * Added fallback user display name resolution for custom user accounts in exported CSV audit files.

### 2026-07-29: SQA Logic Bug Fixes Execution
* **House Settlement Prop Leakage Fix (`src/App.tsx`)**:
  * Passed `houseSettlements` to `<Dashboard>`, `<SettlementView>`, and `<MonthlySummary>` instead of raw `settlements`.
* **Exact Remainder Cent Allocation (`src/components/AddExpenseModal.tsx`)**:
  * Base shares use integer division (`Math.floor(totalCents / count)`) with remainder cents allocated to the primary payer/participant, ensuring `sum(share.amountCents)` EXACTLY matches `totalExpense.amountCents`.
* **Strict UID Matching in Debt Engine (`src/utils/settlementEngine.ts`)**:
  * Refactored `calculateNetBalances` and `getHouseUsers` to match users by unique `uid`/`id` rather than display name strings.
* **Firestore Listener House Scoping & Aliases (`src/utils/firebaseSync.ts`)**:
  * Scoped queries with `where('houseId', '==', houseId)` and exported `subscribeToExpenses` and `subscribeToSettlements` aliases.
* **React Hook Dependencies (`src/components/AddExpenseModal.tsx`)**:
  * Included `[isOpen, initialExpense, houseUsers, activeUserId, cards]` in the modal initialization `useEffect`.

### 2026-07-29: Single User Fallback Resolution for Unassigned Accounts
* **Single User Resolution (`src/utils/settlementEngine.ts`)**:
  * Refactored `getHouseUsers(currentHouse, dbUserProfile)` so that when a user is not in any house (`currentHouse` is `null`), `getHouseUsers` returns **ONLY that user** (e.g. `[Himel]`), instead of defaulting to all users.
* **Component Integration Across All Views**:
  * Updated `App.tsx`, `Dashboard.tsx`, `SettlementView.tsx`, `ExpenseList.tsx`, `MonthlySummary.tsx`, `CategoryChart.tsx`, and `AddExpenseModal.tsx` to pass `dbUserProfile` to `getHouseUsers`.

### 2026-07-30: Fix 10 Broken Business Logics & Implementation of Features 1, 4, 6, 8
1. **User ID Identity Standardization (`AuthContext.tsx`, `settlementEngine.ts`, `AddExpenseModal.tsx`)**:
   * Ensured `activeUserId` matches `dbUserProfile.uid` or static fallback IDs consistently.
2. **Cloud Firestore Sync on Reset (`App.tsx`)**:
   * Called `syncDeleteExpense`, `syncSaveSettlement`, `syncDeleteCard` during demo data reset so old cloud items are cleared and re-seeded cleanly.
3. **Percentage & Custom Split Remainder Calculations (`AddExpenseModal.tsx`, `currency.ts`)**:
   * Implemented deterministic remainder distribution and normalized floating percentage inputs to 100% within a 0.5% tolerance.
4. **Settlement Reversals & Audit History (`types/index.ts`, `settlementEngine.ts`, `SettlementView.tsx`, `App.tsx`)**:
   * Added `status: 'completed' | 'reversed'`, `reversedAt`, `reversedBy` to `Settlement`.
   * Ignore reversed settlements in net balances and display a `[Reversed]` badge with an "Undo Settlement" action button.
5. **Personal Expense Scope & Out-of-Pocket Accounting (`AddExpenseModal.tsx`, `PersonalWallet.tsx`)**:
   * Automatically assigned `ownerId: activeUserId`. Converted out-of-pocket payments by User B for User A's personal purchase to shared household expenses split between User A and User B.
6. **Automated Recurring Expense Generator Engine (`App.tsx`)**:
   * Built `useEffect` engine checking `isRecurring === true` expenses and automatically cloning/generating new period instances upon app launch.
7. **Isolated Departed / Kicked Member Debts (`settlementEngine.ts`)**:
   * Accumulated historical paid and share amounts of former house members into a "Departed Member" balance pool so active housemates' net sum remains balanced ($\sum \text{Net} = 0$).
8. **Persistent Personal & Category Monthly Budgets (`PersonalWallet.tsx`)**:
   * Persisted `monthlyBudgetTaka` and category budget limits in `localStorage` under `home_finance_personal_budget_v1`. Displayed real-time progress bars with 80% (amber) and 100% (rose) warning badges.
9. **Cascade Handling for Deleted Payment Cards (`CardsManager.tsx`, `ExpenseList.tsx`, `App.tsx`)**:
   * Prompted user with confirmation notice when deleting a card linked to expenses. Scrubbed linked card IDs to cash or rendered `(Deleted Card)` badge.
10. **100% Bilingual UI Binding (EN / BN) (`i18n.ts`, `currency.ts`, `ocrScanner.ts`, all components)**:
    * Added complete translation keys for English and Bengali. Added Bengali digit conversion (`০-৯`) in `currency.ts` and filtered Bangladeshi phone numbers & dates in `ocrScanner.ts`.

### 2026-07-30: Complete Project Reset Preserving Demo Accounts
* **Master Reset (`src/utils/storage.ts`, `src/utils/mockAuthDatabase.ts`, `src/App.tsx`)**:
  * Purged all expenses, cards, settlements, and category budget data across `localStorage` and Cloud Firestore.
  * Preserved intact demo user IDs (`raiyan`, `himel`, `lazim`) and standard house structure (`house-demo-001`).

### 2026-07-31: 8 Post-Deployment Features Built & Deployed
* **1.1 Live Firebase Environment Sync Badge (`src/config/firebase.ts`, `SettingsView.tsx`)**: Added `isFirebaseConfigured` environment validator and live connection badge (🟢 *Cloud Sync Active* / 🟡 *Offline Local Storage Mode*).
* **1.2 PWA Manifest & Mobile Installability (`public/manifest.json`, `index.html`)**: Added standalone Web App Manifest with SVG maskable icon and iOS/Android "Add to Home Screen" meta tags.
* **1.3 1-Click JSON Data Backup & Restore (`src/utils/storage.ts`, `SettingsView.tsx`)**: Added 📥 Export Backup JSON and 📤 Import Backup JSON file tools with timestamped JSON structure validation.
* **2.2 Proof of Payment Uploads (`SettlementView.tsx`)**: Added bKash/Nagad/bank screenshot upload picker on debt settlements and `[Attached Proof 📎]` button opening full photo preview modal on audit history records.
* **2.3 Push Notifications & Reminders Helper (`src/utils/notifications.ts`, `App.tsx`, `SettingsView.tsx`)**: Created Web Notification helper with browser permission toggle for instant alerts on new expenses and pending debt transfers.
* **3.1 Printable PDF Financial Statement Generator (`MonthlySummary.tsx`, `index.css`)**: Added **"📄 Download Statement PDF"** button triggering browser print dialog (`window.print()`) with clean background print styles.
* **4.1 Native Web Share API Integration (`src/utils/share.ts`, `SettingsView.tsx`, `SettlementView.tsx`)**: Created Web Share API helper wrapping `navigator.share()` with clipboard fallback for sharing House Join Codes (`HM-8823`) and settlement transfer instructions via WhatsApp/SMS.
* **4.2 Custom Theme Accent Picker (`index.css`, `Navbar.tsx`, `SettingsView.tsx`)**: Added CSS attributes and UI color pickers for `charcoal`, `midnight`, `emerald`, and `amber` accents persisted in `localStorage`.

### 2026-07-31: Transition App to Production (Open Public Registration & Zero Demo Data)
* **Purged Demo Accounts & Sample Seed Data (`mockAuthDatabase.ts`, `storage.ts`)**:
  * Set `DEFAULT_USERS = []` and `DEFAULT_HOUSE = null`. Default `loadExpenses()`, `loadSettlements()`, and `loadCards()` to `[]`.
* **Clean Production Login UI (`LoginPage.tsx`, `AuthModal.tsx`)**:
  * Removed 1-click quick demo buttons. Rendered clean login form with email, password, and sign up links.
* **Open Registration & Strict Password Authentication (`AuthContext.tsx`)**:
  * Removed `AUTHORIZED_DEMO_ACCOUNTS` map. Open registration allows any visitor to sign up with valid email, password (>= 6 chars), and display name.
  * Throws `"Email is already registered. Please log in."` if email is taken. Strict login throws `"Invalid email or password. Please verify your credentials or Sign Up."`.
* **First-Time User Onboarding Banner (`App.tsx`)**:
### 2026-07-31: UI/UX Refinement — Dynamic Initials, House Tab & Clean Settings
* **Dynamic Initials Avatar (`UserAvatar.tsx`, `Navbar.tsx`)**:
  * Removed demo PNG image fallbacks from sidebar profile card. Replaced with dynamic uppercase initials badge rendered on a clean HSL gradient circle.
* **Sidebar Cleanup (`Navbar.tsx`)**:
  * Removed `+ New Expense` button from desktop sidebar. Expense creation is handled directly in Expense List view.
* **Dedicated House Navigation Tab (`HouseView.tsx`, `Navbar.tsx`, `App.tsx`)**:
  * Created `HouseView.tsx` and added `House` (🏠) tab to desktop sidebar & mobile nav.
  * Moved House Creation, House Join, House Join Code 1-click copy/share, inline House Name edit, and Member Roster Table into `HouseView.tsx`.
### 2026-08-01: Profile Picture Upload, Password Change & Universal Show/Hide Password Toggles
* **Custom Profile Picture Upload (`SettingsView.tsx`, `AuthContext.tsx`, `UserAvatar.tsx`)**:
  * Added image upload input (< 2MB) converting profile photo to base64 data URL.
  * Implemented `updateUserProfilePhoto(avatarUrl)` in `AuthContext.tsx` syncing to `loadUsersDB()`, Firestore, and Firebase Auth `updateProfile({ photoURL })`.
  * Updated `UserAvatar.tsx` to render base64/URL profile avatar images seamlessly across all user cards.
* **Current Password Verification & Change Password (`SettingsView.tsx`, `AuthContext.tsx`)**:
  * Implemented `changeUserPassword(currentPass, newPass)` verifying `currentPass` against stored local credentials and Firebase Auth re-authentication (`EmailAuthProvider.credential`).
  * Throws `"Current password is incorrect."` on invalid verification.
### 2026-08-01: Dashboard Layout Optimization (Left Column Analytics)
* **Left Column Card Restructuring (`Dashboard.tsx`, `CategoryChart.tsx`)**:
  * Extracted `PayerContributionCard` from `CategoryChart.tsx`.
  * Positioned **Payer Out-of-Pocket Contribution Ratio** card and **Payment Channel Distribution** card directly beneath `Recent Shared Expenses` in the Left Column of the dashboard grid, eliminating empty whitespace beneath the recent expenses card.
### 2026-08-01: Live Production Multi-User Sync Bug Fixes
* **Realtime House Roster Listener (`firebaseSync.ts`, `AuthContext.tsx`)**:
  * Implemented `subscribeHouse(houseId)` in `firebaseSync.ts` and subscribed in `AuthContext.tsx`. When Member B joins via house code, Member A's screen updates the member roster live in real-time without reloading.
* **Strict Card Ownership Isolation (`CardsManager.tsx`, `App.tsx`)**:
  * Filtered `userCards` by `ownerId === myUid || ownerId === activeUserId` to prevent payment card leakage between different housemates.
  * Explicitly attached `ownerId: dbUserProfile.uid || activeUserId` and `houseId: currentHouse?.id` on newly created cards.
### 2026-08-01: Comprehensive Production Bugs 1.1 to 6.2 Audit & Fix
* **Section 1 (Auth Lifecycle & Listener)**: Attached `onAuthStateChanged(auth, (user) => setFirebaseUser(user))` in `AuthContext.tsx` to keep `firebaseUser` reactive across sessions.
* **Section 2 (House Roster & Realtime Sync)**: Added `subscribeHouse(houseId)` for live multi-device roster updates and `await`ed `syncSaveHouse(newHouse)` during house creation.
* **Section 3 (Financial Calculations & Settlement Reversals)**: Standardized expense shares strictly by UID in `settlementEngine.ts` and enabled settlement reversals (`status: 'reversed'`) in `SettlementView.tsx`.
* **Section 4 (Expenses, OCR & Personal Scope Isolation)**: Fixed personal scope out-of-pocket shares in `AddExpenseModal.tsx` so non-owner payers receive 100% credit, integrated canvas/text OCR scanner in `ocrScanner.ts`, and active automated recurring expense generator in `App.tsx`.
* **Section 5 (Cards & Wallet Isolation)**: Enforced strict card ownership filtering in `CardsManager.tsx` & `App.tsx`, persisted personal monthly budget target in `PersonalWallet.tsx`, and handled deleted card cascades.
### 2026-08-01: Purged Default Profile Picture Fallbacks & Fixed Live Cross-Device House Sync
* **Purged Default PNG Profile Pictures (`settlementEngine.ts`, `UserAvatar.tsx`, `Navbar.tsx`)**:
  * Removed demo PNG image imports (`raiyan.png`, `himel.png`, `lazim.png`). Set `avatar: undefined` for all users without a custom uploaded photo so `UserAvatar` renders clean dynamic initials badges on color gradient circles for all accounts.
### 2026-08-01: Firestore Data Sanitization & Realtime User/House Listener Fix
* **Firestore Data Sanitization (`firebaseSync.ts`)**:
  * Implemented `sanitizeForFirestore<T>(data)` to recursively strip `undefined` properties from JavaScript objects before calling `setDoc()`.
  * Fixes the hidden Firestore `Unsupported field value: undefined` exception that caused `syncSaveHouse(house)` and `syncSaveUser(userProfile)` to throw silently on live Cloud Firestore.
### 2026-08-01: Settlement Debt Recalculation & Live Expense Attribution Fix
* **Live Member UID Expense Attribution (`AddExpenseModal.tsx`, `App.tsx`)**:
  * Passed `houseUsers={houseUsers}` and `activeUserId={dbUserProfile?.uid || activeUserId}` to `<AddExpenseModal>` in `App.tsx`.
  * Updated `AddExpenseModal` to default `paidBy` to the authenticated user's actual UID (`dbUserProfile.uid`) instead of falling back to static `'raiyan'`.
### 2026-08-01: Live Production Business Logic Audit & Scoping Resolution
* **Household Expense & Settlement Member UID Matching (`App.tsx`)**:
  * Enhanced `householdExpenses` and `houseSettlements` filters in `App.tsx` to match expenses and settlements against `currentHouse.id` as well as all active house member UIDs (`memberUids`).
  * Guarantees 100% visibility of shared household expenses across all connected devices and browsers on live production.
### 2026-08-01: Dashboard Payer Contribution Ratio Calculation Fix
* **Flexible Payer UID & Profile Matching (`CategoryChart.tsx`)**:
  * Updated `PayerContributionCard` in `CategoryChart.tsx` to match `e.paidBy` case-insensitively against `user.id`, `user.uid`, `user.name`, `user.email`, and `user.email.split('@')[0]`.
### 2026-08-01: Settlement Recipient-Only Mark as Paid Restriction
* **Recipient Confirmation Authorization (`SettlementView.tsx`, `i18n.ts`)**:
  * Implemented `isRecipientUser(tx)` in `SettlementView.tsx` matching `myUid` against `tx.toUser` (the recipient receiving the money).
### 2026-08-01: Strict Private Payment Card Ownership Isolation
* **User-Scoped Card Subscription & Filter (`firebaseSync.ts`, `App.tsx`)**:
  * Updated `subscribeCards` in `firebaseSync.ts` to query Cloud Firestore `cards` strictly by `ownerId == cardOwnerId` (`dbUserProfile?.uid || activeUserId`).
  * Updated `userCards` in `App.tsx` to filter cards strictly by `ownerId === myUid`.
### 2026-08-01: Cards Manager Undefined Owner Resolver Crash Fix
### 2026-08-01: Page-Object Model (POM) & Feature-Based Modular Architecture Refactoring
* **Page-Object Pattern (`src/pages/`)**:
  * Moved view components to `src/pages/`: `DashboardPage.tsx`, `ExpenseListPage.tsx`, `SettlementPage.tsx`, `PersonalWalletPage.tsx`, `CardsPage.tsx`, `MonthlyPage.tsx`, `HousePage.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, and `SignUpPage.tsx`.
* **Services Layer (`src/services/`)**:
  * Moved data drivers to `src/services/`: `firebaseSync.ts`, `storage.ts`, and `mockAuthDatabase.ts`.
* **Feature Business Engines (`src/features/`)**:
  * Moved business engines to `src/features/`: `settlementEngine.ts`, `ocrScanner.ts`, and `exportCsv.ts`.
### 2026-08-01: User Display Name Comment & Profile Attribution Fix
* **Member Display Name Comment Attribution (`App.tsx`, `ExpenseListPage.tsx`, `settlementEngine.ts`, `AuthContext.tsx`)**:
  * Updated `handleAddComment` in `App.tsx` to set `userId: dbUserProfile?.uid || activeUserId`.
  * Updated `getHouseUsers` in `settlementEngine.ts` to resolve `currentUser.displayName` for active members.
### 2026-08-01: Household Expense Card Item UI Restructure
* **Vertical Sub-Row Metadata Stacking (`ExpenseListPage.tsx`)**:
  * Updated expense card items in `ExpenseListPage.tsx` to stack metadata vertically in exact requested hierarchy:
    1. `Paid by PayerName`
    2. `Date: 2026-08-01` (under Paid by)
    3. `Split: equal` (under Date)
    4. `💬 X Comments` (under Split)
### 2026-08-01: Profile Picture Global Sync & Multi-Component Rendering Fix
* **Global Avatar Propagation (`UserAvatar.tsx`, `AuthContext.tsx`, `settlementEngine.ts`, `HousePage.tsx`, `SettingsPage.tsx`, `CardsPage.tsx`)**:
  * Updated `UserAvatar.tsx` to detect Base64, HTTP/HTTPS, Blob, and relative image URLs.
  * Updated `updateUserProfilePhoto` in `AuthContext.tsx` to update `currentHouse.members` in local DB and Firestore `houses/{houseId}` so all housemates receive avatar updates in real-time.
  * Updated `getHouseUsers` in `settlementEngine.ts` to map `rawAvatar` for active users and members.
### 2026-08-01: Liquid Metal WebGL Shader & Button Hover Shimmer Effect
* **Liquid Metal Shader & Metallic Shimmer (`LiquidMetalButton.tsx`, `index.css`)**:
### 2026-08-01: Add Expense Modal Payer Selection Authorization Rule
* **Leader-Only Payer Reattribution Rule (`AddExpenseModal.tsx`)**:
  * Updated `AddExpenseModal.tsx` so regular house members (`role != 'leader'`) default to and lock onto their own account (`myUid`) in the "Who Paid Out-of-Pocket?" section.
  * Restricted selecting other members as the expense payer exclusively to the **House Leader** (`isLeader`).
  * Added visual locks (`opacity: 0.45`, `cursor: 'not-allowed'`) and helper badge `👑 Leader access required to attribute to others` for non-leaders.
### 2026-08-01: Rotating Liquid Rainbow Neon Border Button Hover Effect
* **Continuous Rotating Color Border (`index.css`, `LiquidMetalButton.tsx`)**:
### 2026-08-01: Household Leave Block for Unsettled Balances Rule
* **Unsettled Settlement & Net Balance Guard (`AuthContext.tsx`)**:
  * Updated `leaveHouse` in `AuthContext.tsx` to compute `calculateNetBalances(houseExpenses, houseSettlements, houseUsers)` before allowing a member to leave.
  * Blocks any member from leaving if `Math.abs(netBalanceCents) > 0` (either owing money or owed money).
  * Displays explanatory error messages detailing the exact outstanding amount (e.g., *"You cannot leave the household while you owe ৳500.00. Please pay your pending settlements before leaving."*).
  * Only permits leaving after all house settlements are 100% completed and net balance is `৳0.00`.
  * Verified with clean build and deployed to live production.
### 2026-08-01: Project Business Logic Audit Fixes & Modern Sidebar UI Redesign
* **Comprehensive Business Logic Fixes**:
  * **Expense Authorization**: Locked expense editing/deletion in `ExpenseListPage.tsx` to expense creator (`paidBy === myUid`) or House Leader.
  * **Settlement Reversal Authorization**: Locked settlement reversal in `SettlementPage.tsx` to payment recipient or House Leader.
  * **Audit Log Clearance Protection**: Locked clearing settlement audit data to House Leaders only with confirmation dialog guard.
  * **Kick Member Balance Check**: Updated `kickMember()` in `AuthContext.tsx` to compute net balances and block kicking members with active non-zero balances.
  * **Expense `createdAt` Preservation**: Fixed `handleSaveExpense` in `App.tsx` to preserve original creation timestamps when editing.
  * **Personal Expense Privacy Isolation**: Prevented `handleSaveExpense` from stamping `houseId` on personal wallet expenses (`scope === 'personal'`).
  * **House Code Length Mismatch**: Updated input `maxLength` to 10 in `HousePage.tsx` to support `HM-XXXX` prefixed code formats.
  * **Recurring Expense Generator Guard**: Updated recurring expense engine in `App.tsx` with parent ID tracking and stable dependencies.
  * **Month-Scoped Settlement Balances**: Filtered settlements by selected month in `MonthlyPage.tsx` for period-isolated reporting.
  * **Backup Password Stripping**: Sanitized `usersDB` exports in `storage.ts` to remove plaintext passwords.
* **Modern Redesigned Sidebar UI (`Navbar.tsx`, `index.css`)**:
  * Matched sidebar color palette to dark greyish charcoal/zinc theme (`#18181b`, `#27272a`, `rgba(24, 24, 27, 0.95)`).
  * Added visual menu sections (`Household Shared`, `Personal Wallet & Cards`, `Preferences`).
  * Added dynamic micro-animations: active titanium pill indicators, icon scale `1.18` on hover, item slide `translateX(4px)`, logo shimmer, and pulsing live status dot.
  * Pinned quick-action `+ Log Expense` CTA button inside sidebar.
### 2026-08-01: Vercel Live Application Architecture Analysis & Configuration
* **Vercel SPA Rewrites & Header Caching (`vercel.json`)**:
  * Created `vercel.json` with wildcard SPA routing rewrites (`/.*` -> `/index.html`) guaranteeing zero 404 URL route refresh issues on live Vercel deployments.
  * Configured immutable HTTP `Cache-Control` header caching rules (`max-age=31536000, immutable`) for compiled `/assets/` bundles.
* **POM Architectural Alignment (`docs/gemini/GEMINI_Project_Analysis.md`)**:
  * Updated complete full-stack architectural document detailing live Vercel and GitHub Pages deployment workflow, Page-Object Model directory structure, authorization rules, and live-app-first balance synchronization.
### 2026-08-01: Modern UI Aesthetics Overhaul & Micro-Animations Engine
* **Typography Upgrade (`index.html`, `index.css`)**:
  * Imported Google Fonts `Plus Jakarta Sans` for main UI body, `Outfit` (`font-display`) for headlines and hero metrics, and `JetBrains Mono` (`font-mono`) for tabular currency amounts and house codes.
* **Keyframes & Micro-Animations Suite (`index.css`)**:
  * Built complete CSS animation engine: `@keyframes fadeInUp`, `@keyframes modalSlideUp`, `@keyframes pulseGlow`, `@keyframes shimmerGlow`, `@keyframes floatSubtle`, and `@keyframes badgePop`.
  * Added staggered entrance animation utilities (`.animate-stagger-1` through `.animate-stagger-5`, `.animate-fade-in`) for dashboard cards, expense ledgers, and settlement recommendations.
* **Glassmorphism & Interactive Feedback (`index.css`, components, pages)**:
  * Enhanced 3D card elevation hover lifts (`translateY(-4px)` with ambient titanium/emerald glow highlights).
  * Implemented glowing input focus rings (`box-shadow: 0 0 0 4px var(--accent-primary-glow)`), active button press feedback, and animated live house status dot pulses.
  * Custom dark zinc scrollbar styling (`::-webkit-scrollbar`).
### 2026-08-01: Household Expense Month Selector & Cumulative Debt Settlement Invariant
* **Household Expense Month Selector (`ExpenseListPage.tsx`)**:
  * Added `selectedMonth` state and `availableMonths` dynamic extraction from expenses sorted in reverse chronological order.
  * Rendered Month/Year `<select>` dropdown in the filter bar allowing housemates to filter expenses by specific months or view `"All Months"`.
### 2026-08-01: Dashboard Section Alignment & Category Donut Chart Text Fit
* **Dashboard Layout Top Alignment (`DashboardPage.tsx`)**:
  * Standardized `<h2>` section headers above both Left Column (`Housemate Net Balances`) and Right Column (`Category Spending Breakdown`) so the top edges of cards align 100% pixel-perfectly.
* **Category Donut Inner Circle & Center Label Scaling (`CategoryPieChart.tsx`)**:
  * Expanded SVG donut dimensions (center `110`, radius `78px`, strokeWidth `22px`) providing a `134px` diameter inner hole.
  * Styled center text container with `whiteSpace: 'nowrap'`, font size scaling (`0.68rem` label, `1.15rem` amount), and letter spacing to fit `"Total Spend"`, currency amounts, and record subtitles cleanly without text overflowing the donut circle.
