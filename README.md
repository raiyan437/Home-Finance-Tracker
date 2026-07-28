# 🏠 Home Finance Tracker

[![CI/CD Pipeline & GitHub Pages Deployment](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen)](https://raiyan437.github.io/Home-Finance-Tracker/)

An ultra-modern, cross-platform household expense tracking, payment card manager, and debt settlement application built for **Raiyan**, **Himel**, and **Lazim**.

---

## 🌟 Key Features

- **Taka (৳) Currency Standard**: All household expenses, balances, debt settlements, and personal budgets are tracked in Bangladeshi Taka (৳).
- **Optimal Debt Simplification**: Solves the minimum cash flow problem to collapse complex multi-party debts into at most $N-1$ direct transfers.
- **Cloud Firestore Realtime Sync**: Realtime multi-device database listeners (`onSnapshot`). Changes on one device instantly update all housemates' screens live.
- **Vite 8 Rolldown Code-Splitting**: Code-split vendor chunks (`react-vendor`, `lucide-icons`, `firebase`) and `React.lazy()` views keep initial JS payload under **72 kB**.
- **Payment Cards & Wallets**: Manage Credit & Debit bank cards with custom color gradients, bank names, and payment channel tracking (Cash vs Bank Cards).
- **Private Personal Wallet**: Log private individual expenses with month/year filters and budget target tracking.
- **Recurring Bills Engine**: Automate monthly or weekly recurring household expenses (WiFi, Rent, Utilities).
- **Receipt Photo Attachments & CSV Export**: Attach receipt photos to expenses and export formatted `.csv` audit statements.
- **3D Character Male Avatars**: Custom 3D rendered character avatars for Raiyan, Himel, and Lazim.

---

## 🚀 Tech Stack

- **Core**: React 18, TypeScript, Vite 8 (Rolldown bundler)
- **Styling**: Vanilla CSS (Midnight Slate Glassmorphic Design Tokens)
- **Database & Auth**: Firebase Auth & Cloud Firestore
- **Icons**: Lucide React
- **CI/CD**: GitHub Actions (Oxlint, Typecheck, Build, & GitHub Pages Deployment)

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

---

## 🔄 CI/CD & Deployment

Every push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`):
1. **Validation**: Runs `oxlint` and `tsc` type-checks.
2. **Build**: Compiles production static bundle into `dist/`.
3. **Deploy**: Publishes live to **[https://raiyan437.github.io/Home-Finance-Tracker/](https://raiyan437.github.io/Home-Finance-Tracker/)**.
