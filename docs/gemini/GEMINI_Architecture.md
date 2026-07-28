# GEMINI Architecture & Technical Specifications

**Purpose**: Architecture, data model specifications, and settlement algorithm design for the Shared Household Expense Settlement Application.  
**Last Updated**: 2026-07-27  
**Current Status**: Active Implementation  

---

## 1. System Overview

The application is a single-page client-side web application designed for a 3-person household:
* **Raiyan**
* **Himel**
* **Lazim**

Its core objective is to track shared & personal expenses and compute the minimal set of transactions required to settle all debts.

---

## 2. Technical Stack

* **Framework**: React 18 / TypeScript / Vite
* **Styling**: Vanilla CSS with CSS Custom Properties, HSL color tokens, responsive container queries & flex/grid systems
* **Icons**: `lucide-react`
* **Persistence**: Browser `localStorage` with initial JSON seed fallback

---

## 3. Data Models

### User Entity
```typescript
export interface User {
  id: string; // 'raiyan' | 'himel' | 'lazim'
  name: string;
  avatar: string;
  color: string; // Accent color token
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

export interface Expense {
  id: string;
  title: string;
  amountCents: number; // Stored in integer cents to avoid floating point bugs
  paidBy: string; // User ID
  category: Category;
  date: string; // YYYY-MM-DD
  splitMethod: SplitMethod;
  shares: Share[];
  notes?: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
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
