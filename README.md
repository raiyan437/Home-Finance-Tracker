# 🏠 Home Finance Tracker

[![CI/CD Pipeline & GitHub Pages Deployment](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/raiyan437/Home-Finance-Tracker/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen)](https://raiyan437.github.io/Home-Finance-Tracker/)

An ultra-modern, single-page household expense tracking and debt settlement application built for **Raiyan**, **Himel**, and **Lazim**.

---

## 🌟 Key Features

- **Optimal Debt Simplification**: Built-in minimum-cash-flow algorithm reduces multi-party debts to minimal direct transfers.
- **Glassmorphism UI/UX**: Sleek dark slate glass design system with backdrop blur, glowing accents, and tabular typography formatting.
- **Spend Distribution Analytics**: Visual category spending progress bars and housemate out-of-pocket contribution ratio visualizers.
- **3D Character Male Avatars**: Custom male character profile avatars for Raiyan, Himel, and Lazim.
- **Flexible Expense Splitting**: Supports Equal, Custom Dollar ($), and Percentage (%) allocation split methods with live share preview.
- **Quick Preset Templates**: One-click preset shortcuts for common household expenses (Weekly Groceries, WiFi Bill, Utilities, etc.).
- **Audit Ledger**: Comprehensive settlement history and transaction audit logs.

---

## 🚀 Tech Stack

- **Framework**: React 18 / TypeScript / Vite
- **Styling**: Vanilla CSS (CSS Custom Properties, Glassmorphism design system)
- **Icons**: Lucide React
- **Linter**: Oxlint
- **CI/CD**: GitHub Actions (Lint, Typecheck, Build, & GitHub Pages Deployment)

---

## 🛠️ Local Development

1. **Clone Repository**:
   ```bash
   git clone https://github.com/raiyan437/Home-Finance-Tracker.git
   cd Home-Finance-Tracker
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Local Server**:
   ```bash
   npm run dev
   ```

4. **Build Production Bundle**:
   ```bash
   npm run build
   ```

---

## 🔄 CI/CD & Deployment

Every push to the `main` branch automatically triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. **Linter & Type Checks**: Runs `oxlint` and `npx tsc -b`.
2. **Build**: Compiles production static assets into `./dist`.
3. **Deploy**: Automatically deploys the static application to **GitHub Pages**.

### GitHub Pages Setup Instructions
1. Navigate to your repository **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
3. Pushes to `main` will automatically build and publish to `https://raiyan437.github.io/Home-Finance-Tracker/`.
