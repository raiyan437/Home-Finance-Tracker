# GEMINI Architecture & Technical Specifications

**Purpose**: Architecture, data model specifications, and settlement algorithm design for the Shared Household Expense Settlement Application.  
**Last Updated**: 2026-08-02  
**Current Status**: Active Production Deployment — [https://home-finance-tracker-kappa.vercel.app/](https://home-finance-tracker-kappa.vercel.app/)  

---

## 1. System Overview

The application is a reactive, client-side Single Page Application (SPA) designed for multi-member households (with custom house creation, invitation codes, and leadership transfer):
* **Household Shared Expenses**: Equal, Percentage, Exact, and Adjustment splits with integer cent math.
* **Personal Money Tracker**: Private wallet outlays with monthly budget targets and category threshold alerts.
* **Payment Card Manager**: Credit/debit card tracking with custom gradients and channel distribution stats.
* **Debt Simplification Solver**: Greedy minimum cash flow engine minimizing transfers to at most $N-1$.

---

## 2. Technical Stack

* **Framework**: React 19 / TypeScript / Vite 8 (Rolldown code-splitter)
* **Routing**: HTML5 History API (`window.location.pathname`, `pushState`, `popstate`) with automatic hash cleaner (`/#/expenses` $\rightarrow$ `/expenses`) and [vercel.json](file:///d:/Others/Google%20Antigravity/Home%20Finance/vercel.json) rewrites
* **Database & Auth**: Firebase Auth + Cloud Firestore Realtime Listeners (`onSnapshot` WebSockets) with `localStorage` offline caching
* **Styling**: Vanilla CSS with CSS Custom Properties, HSL color tokens, glassmorphism, responsive container queries & keyframe engines
* **Icons**: `lucide-react`
* **CI/CD**: GitHub Actions (`tsc -b`, `npm run build`, GitHub Pages) & Vercel Auto-Deploy

---

## 3. Data Models

### User Entity & Profile
```typescript
export type UserRole = 'leader' | 'member';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string; // Accent color token
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  avatar?: string;
  houseId?: string | null;
  role?: UserRole | null;
  createdAt: string;
  updatedAt: string;
}
```

### Household Entity
```typescript
export interface HouseMember {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
  role: UserRole;
}

export interface House {
  id: string;
  name: string;
  code: string; // Unique join code (e.g. HM-7842)
  leaderUid: string;
  members: HouseMember[];
  createdAt: string;
  updatedAt: string;
}
```

### Payment Card Entity
```typescript
export interface PaymentCard {
  id: string;
  ownerId?: string; // Strict ownership scoping
  bankName: string;
  cardType: 'credit' | 'debit';
  colorGradient: string; // Preset or custom CSS gradient
  createdAt: string;
}
```

### Expense Entity
```typescript
export type Category = 'Groceries' | 'Household' | 'Utilities' | 'Food' | 'Personal' | 'Other';
export type SplitMethod = 'equal' | 'custom' | 'percentage';

export interface Share {
  userId: string;
  amountCents: number;
  percentage?: number;
}

export interface PaymentMethodInfo {
  type: 'cash' | 'card';
  cardId?: string;
  cardName?: string; // Metadata snapshot for cross-member audit
  cardType?: 'credit' | 'debit';
}

export interface Expense {
  id: string;
  scope?: 'household' | 'personal';
  ownerId?: string;
  title: string;
  amountCents: number; // Integer cents precision
  paidBy: string;
  category: Category;
  date: string; // YYYY-MM-DD
  splitMethod: SplitMethod;
  shares: Share[];
  paymentMethod?: PaymentMethodInfo;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Settlement Entity
```typescript
export interface Settlement {
  id: string;
  fromUserId: string; // Debtor
  toUserId: string;   // Creditor
  amountCents: number;
  status: 'completed';
  createdAt: string;
  settledAt: string;
  notes?: string;
}
```

---

## 4. Debt Simplification Algorithm

### Mathematical Model
1. For every active `Expense`:
   * Payer gets `+amountCents` credited to their gross paid balance.
   * Each participant gets `-share.amountCents` debited from their net balance.

2. For every completed `Settlement`:
   * `fromUserId` (payer of settlement) receives `+amountCents` in net balance.
   * `toUserId` (recipient of settlement) receives `-amountCents` in net balance.

3. Net Balance Formula:
   $$\text{Net Balance}_u = \sum \text{Paid By } u - \sum \text{Shares of } u + \sum \text{Settlements Paid By } u - \sum \text{Settlements Received By } u$$

4. Cash Flow Minimization Solver:
   * Maintain priority queues for `Creditors` ($\text{Net} > 0$) and `Debtors` ($\text{Net} < 0$).
   * Sort debtors by ascending balance (most negative first) and creditors by descending balance (most positive first).
   * Pop top debtor $D$ and top creditor $C$:
     $$\text{transfer} = \min(-D.\text{balance}, C.\text{balance})$$
   * Yield recommendation: "$D$ pays $C$ \$\text{transfer}$".
   * Update balances and re-insert into queues if remaining balance $\neq 0$.
   * Guarantees at most $N-1$ transfers.
