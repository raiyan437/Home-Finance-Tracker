export type UserId = 'raiyan' | 'himel' | 'lazim';

export interface User {
  id: UserId;
  name: string;
  avatar: string;
  color: string; // CSS color string or accent token
  email?: string;
  uid?: string; // Firebase Auth UID if authenticated
}

export type Category = 'Groceries' | 'Household' | 'Utilities' | 'Food' | 'Personal' | 'Other';

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export type ExpenseScope = 'household' | 'personal';

export type PaymentMethodType = 'cash' | 'card';

export type RecurringFrequency = 'monthly' | 'weekly';

export interface PaymentCard {
  id: string;
  bankName: string;
  color: string; // Gradient or CSS color token
  ownerId?: UserId;
  createdAt: string;
}

export interface PaymentMethodInfo {
  type: PaymentMethodType;
  cardId?: string; // ID of PaymentCard if type === 'card'
}

export interface Share {
  userId: UserId;
  amountCents: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  title: string;
  amountCents: number; // Stored in integer cents to prevent floating point inaccuracies
  paidBy: UserId;
  category: Category;
  date: string; // YYYY-MM-DD format
  splitMethod: SplitMethod;
  shares: Share[];
  scope?: ExpenseScope; // 'household' (shared) vs 'personal' (private wallet)
  ownerId?: UserId;     // Owner ID for personal private expenses
  paymentMethod?: PaymentMethodInfo; // Cash vs specific Card
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  receiptUrl?: string; // Base64 data URL or photo link
  notes?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface Settlement {
  id: string;
  fromUserId: UserId; // Payer of debt
  toUserId: UserId;   // Recipient of debt
  amountCents: number;
  status: 'completed';
  createdAt: string;
  settledAt: string;
  notes?: string;
}

export interface UserBalance {
  user: User;
  totalPaidCents: number;
  totalShareCents: number;
  netBalanceCents: number; // Positive = should receive, Negative = owes, 0 = settled
}

export interface SimplifiedTransaction {
  id: string;
  fromUser: User;
  toUser: User;
  amountCents: number;
}

export interface MonthlyStats {
  monthKey: string; // e.g. "2026-07"
  monthLabel: string; // e.g. "July 2026"
  totalExpensesCents: number;
  userBalances: Record<UserId, UserBalance>;
  expenseCount: number;
}

export interface PersonalBudget {
  userId: UserId;
  monthlyLimitCents: number;
}
