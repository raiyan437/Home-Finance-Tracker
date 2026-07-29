# Home Finance Tracker - Complete Feature Testing Specification (`Tester.md`)

**Purpose**: Comprehensive automated & manual testing manual for verifying all core architectural features, financial engines, authentication guards, and household management workflows in the Home Finance Tracker application.  
**Location**: `Tester/Tester.md`  
**Last Updated**: 2026-07-29  

---

## 📋 Table of Contents
1. [Test Suite 1: Authentication & Strict Access Control](#test-suite-1-authentication--strict-access-control)
2. [Test Suite 2: Standalone Auth Routing & Session Management](#test-suite-2-standalone-auth-routing--session-management)
3. [Test Suite 3: Household Management & Leader Powers](#test-suite-3-household-management--leader-powers)
4. [Test Suite 4: Financial Balance Engine & Debt Settlement](#test-suite-4-financial-balance-engine--debt-settlement)
5. [Test Suite 5: Payment Cards & Channel Tracking](#test-suite-5-payment-cards--channel-tracking)
6. [Test Suite 6: Private Personal Wallet](#test-suite-6-private-personal-wallet)
7. [Test Suite 7: AI OCR Scanner & Receipt Attachments](#test-suite-7-ai-ocr-scanner--receipt-attachments)
8. [Test Suite 8: Discussion Threads & Localization (EN/BN)](#test-suite-8-discussion-threads--localization-enbn)
9. [Test Suite 9: Cloud Synchronization & Resilience](#test-suite-9-cloud-synchronization--resilience)

---

## Test Suite 1: Authentication & Strict Access Control

### TC-1.1: Pre-Approved Dummy Account Sign In
- **Objective**: Verify that only authorized dummy accounts can log into the application.
- **Authorized Credentials**:
  - **Raiyan**: `raiyan@gmail.com` | Password: `dummy123`
  - **Himel**: `himel@gmail.com` | Password: `dummy123`
  - **Lazim**: `lazim@gmail.com` | Password: `dummy123`
- **Steps**:
  1. Open application at `http://localhost:5173/` or GitHub Pages link.
  2. Enter `raiyan@gmail.com` and `dummy123`. Click **Log In**.
  3. Repeat for `himel@gmail.com` and `lazim@gmail.com`.
- **Expected Result**: Login succeeds instantly, active user profile is loaded, and main Dashboard opens.

### TC-1.2: Rejection of Unauthorized Credentials
- **Objective**: Verify that any unauthorized email or incorrect password combination is strictly blocked.
- **Steps**:
  1. Enter `hacker@gmail.com` with password `password123`.
  2. Click **Log In**.
  3. Enter `raiyan@gmail.com` with incorrect password `wrongpass`. Click **Log In**.
- **Expected Result**: Login is rejected with error banner:  
  `"Access Denied: Only pre-approved housemate accounts (raiyan@gmail.com, himel@gmail.com, lazim@gmail.com) with password "dummy123" are authorized."`

### TC-1.3: 1-Click Demo Login & Strict User Switching
- **Objective**: Test 1-click demo login buttons on `LoginPage.tsx` and verify user switching is only possible via Log Out.
- **Steps**:
  1. Click **"Raiyan (raiyan@gmail.com)"** button on `LoginPage.tsx`.
  2. Verify Raiyan is logged in and Dashboard opens with NO popup modals.
  3. Click **"Log Out"** button in sidebar footer or Settings page.
  4. Verify app redirects to standalone `LoginPage.tsx`. Click **"Himel (himel@gmail.com)"**.
- **Expected Result**: 1-click button authenticates user. No modal overlays pop up after login or logout. User switching occurs strictly via Log Out and Login.

---

## Test Suite 2: Standalone Auth Routing & Session Management

### TC-2.1: Standalone Login & Sign Up Pages (Zero Auth Modals)
- **Objective**: Ensure Login and Sign Up render as full standalone pages without modal overlays.
- **Steps**:
  1. Access root URL when unauthenticated.
  2. Observe full-screen `LoginPage.tsx`.
  3. Click **"Sign Up Here"** link.
- **Expected Result**: App smoothly transitions to standalone `SignUpPage.tsx`. All modal overlays are removed.

### TC-2.2: Log Out Session Clearing & Redirect
- **Objective**: Verify that clicking Log Out clears active session and returns user to LoginPage.
- **Steps**:
  1. Log in as Raiyan.
  2. Click red **"Log Out / Switch User"** button in sidebar footer or Settings page.
- **Expected Result**: Session is destroyed, state is reset, and standalone `LoginPage.tsx` is rendered.

---

## Test Suite 3: Household Management & Leader Powers

### TC-3.1: House Creation & Code Generation
- **Objective**: Verify house creation by leader and 6-character House Code generation.
- **Steps**:
  1. Log in as Raiyan. Go to **Settings ⚙️**.
  2. Enter House Name: `"Villa Flat 4B"`. Click **Create House**.
- **Expected Result**: House is created, House Code banner displays code (e.g. `HM-8823`), and Raiyan is assigned 👑 `leader` role badge.

### TC-3.2: 1-Click Copy House Code
- **Objective**: Verify clipboard copying of the 6-character House Code.
- **Steps**:
  1. Click **"📋 Copy House Code"** button in Settings.
- **Expected Result**: Button turns green with `"Copied!"` badge, code is copied to system clipboard.

### TC-3.3: Joining an Existing House
- **Objective**: Test housemate joining via House Code.
- **Steps**:
  1. Log in as Himel. Go to **Settings ⚙️**.
  2. Enter House Code `HM-8823`. Click **Join House**.
- **Expected Result**: Himel is added to `Villa Flat 4B` member roster with 👤 `member` badge.

### TC-3.4: Leader Kick Member Power
- **Objective**: Verify that House Leaders can kick members from the roster.
- **Steps**:
  1. Log in as Raiyan (Leader). Go to **Settings ⚙️**.
  2. Locate Himel in member roster. Click red **"Kick Member"** button.
- **Expected Result**: Himel is removed from house roster, Himel's `houseId` is reset to `null` in realtime.

### TC-3.5: Leader House Name Editing Power
- **Objective**: Verify that House Leaders can edit and rename the household name.
- **Steps**:
  1. Log in as Raiyan (Leader). Go to **Settings ⚙️**.
  2. Click **"Edit Name ✏️"** button inside the House Banner.
  3. Change house name to `"Sunset Penthouse 5A"`. Click **Save**.
- **Expected Result**: House name updates instantly across the Settings page, top header, and left sidebar.

---

## Test Suite 4: Financial Balance Engine & Debt Settlement

### TC-4.1: Equal Split Calculation & Integer Cent Accuracy
- **Objective**: Verify exact equal split calculation down to ৳0.01.
- **Steps**:
  1. Click **+ New Expense**. Enter Title: `"Groceries"`, Amount: `৳100.00`, Paid By: Raiyan.
  2. Select equal split among Raiyan, Himel, Lazim. Click **Save Expense**.
- **Expected Result**: Each member's share is ৳33.33 / ৳33.33 / ৳33.34. Total equals exactly ৳100.00 without floating point drift.

### TC-4.2: Greedy Cash Flow Settlement Minimization
- **Objective**: Verify minimum transaction debt simplification algorithm.
- **Steps**:
  1. Check **Settlements** tab.
- **Expected Result**: Displays simplified direct node-to-node transfer cards (at most $N-1$ transactions).

---

## Test Suite 5: Payment Cards & Channel Tracking

### TC-5.1: Card Creation & Type Classification
- **Objective**: Test creation of Credit vs Debit cards with gradient themes.
- **Steps**:
  1. Go to **Payment Cards 💳** tab. Click **+ Add Bank Card**.
  2. Enter Bank Name: `"Standard Chartered"`, Select Card Type: **Credit Card**, Color: **Solar Yellow**.
- **Expected Result**: 3D Card preview renders prominent `CREDIT CARD` badge and yellow gradient background.

---

## Test Suite 6: Private Personal Wallet

### TC-6.1: Logging Private Outlays
- **Objective**: Verify private personal outlays are hidden from shared household debt computations.
- **Steps**:
  1. Click **+ New Expense**. Select Scope: **Personal Wallet**.
  2. Enter Title: `"Personal Coffee"`, Amount: `৳5.00`.
- **Expected Result**: Expense appears only in **Personal Wallet** tab and does not affect household net balances.

---

## Test Suite 7: AI OCR Scanner & Receipt Attachments

### TC-7.1: Receipt Photo Upload & OCR Parsing
- **Objective**: Test attaching receipt photos and automatic text parsing.
- **Steps**:
  1. In **Add Expense Modal**, click **Upload Receipt Image**.
  2. Attach sample receipt PNG/JPEG image.
- **Expected Result**: Receipt preview image appears, AI OCR parses text to auto-fill Title, Amount in ৳, and Date.

---

## Test Suite 8: Discussion Threads & Localization (EN/BN)

### TC-8.1: In-App Expense Discussion Comments
- **Objective**: Test leaving comments under expanded expenses.
- **Steps**:
  1. Go to **Household Expenses** tab. Expand an expense item.
  2. Type comment: `"Is this receipt verified?"`. Click **Post Comment**.
- **Expected Result**: Comment appears under discussion thread with user avatar and timestamp.

### TC-8.2: Bilingual English / Bangla (🇧🇩) Toggle
- **Objective**: Test instant UI localization.
- **Steps**:
  1. Click **🇧🇩 বাংলা** button in sidebar footer.
- **Expected Result**: UI text labels switch to Bengali (ড্যাশবোর্ড, মোট খরচ, সেটিংসমূহ).

---

## Test Suite 9: Cloud Synchronization & Resilience

### TC-9.1: Realtime House-Scoped Firestore Listener
- **Objective**: Verify `onSnapshot` realtime sync filtered by `houseId`.
- **Steps**:
  1. Open app in two browser windows (Window A: Raiyan, Window B: Himel in same house).
  2. Log new expense in Window A.
- **Expected Result**: Window B automatically updates in realtime without refreshing the page.

### TC-9.2: React Error Boundary Recovery
- **Objective**: Ensure uncaught UI exceptions do not render a blank screen.
- **Steps**:
  1. Verify app container is wrapped with `ErrorBoundary`.
- **Expected Result**: Uncaught component errors display a clean recovery card with error details and a **Reload Application** button.
