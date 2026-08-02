# 🏠 Home Finance Tracker

[![CI/CD Pipeline & GitHub Pages Deployment](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen)](https://raiyan437.github.io/Home-Finance-Tracker/)

An ultra-modern, cross-platform household expense tracking, payment card manager, and debt settlement application built for **Raiyan**, **Himel**, and **Lazim**.

---

## 🌟 Key Features

- **Clean HTML5 Routing & Vercel Rewrites**: Real URLs (`/expenses`, `/settlement`, `/cards`, etc.) with zero hash tags and [vercel.json](file:///d:/Others/Google%20Antigravity/Home%20Finance/vercel.json) rewrites preventing 404 page refreshes.
- **Taka (৳) Currency Standard**: All household expenses, balances, debt settlements, and personal budgets are tracked in Bangladeshi Taka (৳).
- **Optimal Debt Simplification**: Solves the minimum cash flow problem to collapse complex multi-party debts into at most $N-1$ direct transfers.
- **Cloud Firestore Realtime Sync**: Separate household and owner-scoped listeners keep shared and private records isolated while syncing changes live.
- **House Management & Leadership Transfer**: Create/join houses using codes (`HM-XXXX`), with leader privileges and full leadership transfer support.
- **Collapsible Sidebar & Leader Crown 👑**: Collapsible desktop navigation with Gold Crown 👑 badges, tooltips, and clean brand header alignment.
- **Household Expense Ledger & Sorting**: Ledger with New-to-Old (default) and Old-to-New sorting, category/payer filters, search, comment threads, and receipt previews.
- **Payer-Scoped Payment Cards**: Users select only their own registered credit/debit cards when logging outlays, with full cross-member transaction audit visibility.
- **Private Personal Wallet**: Log private individual expenses with month/year filters and budget target tracking.
- **Recurring Bills Engine**: Automate monthly or weekly recurring household expenses (WiFi, Rent, Utilities).
- **Receipt OCR & CSV Export**: Tesseract.js reads receipt images on demand, while audit statements export as formatted `.csv` files.
- **Security Rules & Scoped Offline Cache**: Firestore rules enforce ownership/house membership and LocalStorage caches are partitioned by household and user.

---

## 🚀 Tech Stack

- **Core**: React 19, TypeScript, Vite 8 (Rolldown bundler)
- **Routing**: HTML5 History API (`window.location.pathname`, `pushState`, `popstate`) + Vercel SPA Rewrites
- **Styling**: Vanilla CSS (Midnight Slate Glassmorphic Design Tokens)
- **Database & Auth**: Firebase Auth & Cloud Firestore
- **Icons**: Lucide React
- **CI/CD**: GitHub Actions & Vercel Auto-Deploy

---

## 🛠️ Portable Local Setup (Any PC: Windows, macOS, Linux)

1. **Clone Repository**:
   ```bash
   git clone https://github.com/raiyan437/Home-Finance-Tracker.git
   cd Home-Finance-Tracker
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Optional - Configure Firebase**:
   Copy `.env.example` to `.env` and fill in your Firebase credentials:
   ```bash
   cp .env.example .env
   ```
   *(If unconfigured, the app seamlessly runs on instant LocalStorage cache).*

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build Production Bundle**:
   ```bash
   npm run build
   ```

6. **Run Automated Business-Logic Tests**:
   ```bash
   npm test
   ```

7. **Deploy Firestore Security Rules**:
   ```bash
   npm run deploy:rules
   ```

---

## 🔄 CI/CD & Deployment

Every push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`):
1. **Validation**: Runs automated tests, `oxlint`, and TypeScript type-checks.
2. **Build**: Compiles production static bundle into `dist/`.
3. **Deploy**: Publishes live to **[https://raiyan437.github.io/Home-Finance-Tracker/](https://raiyan437.github.io/Home-Finance-Tracker/)**.
