export type UserId = 'raiyan' | 'himel' | 'lazim' | string;

export type HouseRole = 'leader' | 'member';

export interface PersonalWalletSettings {
  monthlyBudgetCents?: number;
  cashBalanceCents?: number;
  cashTrackedExpenseCents?: number;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  avatar?: string;
  houseId?: string | null;
  role?: HouseRole | null;
  walletSettings?: PersonalWalletSettings;
  createdAt: string;
}

export interface HouseMember {
  uid: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: HouseRole;
  joinedAt: string;
}

export interface House {
  id: string; // House Document ID
  code: string; // 6-character Code (e.g. 'HM-8823')
  name: string;
  leaderUid: string;
  members: HouseMember[];
  memberUids?: string[]; // Denormalized membership index used by Firestore rules
  memberMap?: Record<string, HouseMember>; // Rule-verifiable canonical roster keyed by UID
  publicJoin?: boolean;
  ledgerRevision?: number; // Monotonic conflict guard for membership changes
  createdAt: string;
}

export interface User {
  id: UserId;
  name: string;
  avatar?: string;
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
  cardType?: 'debit' | 'credit'; // 'debit' vs 'credit'
  color: string; // Gradient or CSS color token
  ownerId?: UserId;
  houseId?: string;
  createdAt: string;
}

export interface PaymentMethodInfo {
  type: PaymentMethodType;
  cardId?: string; // ID of PaymentCard if type === 'card'
  cardName?: string; // Cached bank name snapshot (e.g. 'City Bank')
  cardType?: 'debit' | 'credit'; // Cached card type snapshot
}

export interface Share {
  userId: UserId;
  amountCents: number;
  percentage?: number;
}

export interface ExpenseComment {
  id: string;
  userId: UserId;
  text: string;
  createdAt: string;
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
  sharesTotalCents?: number; // Denormalized invariant checked by security rules
  participantUids?: string[]; // Ordered share identities used by security rules
  scope?: ExpenseScope; // 'household' (shared) vs 'personal' (private wallet)
  ownerId?: UserId;     // Owner ID for personal private expenses
  houseId?: string;     // House ID for scoping household expenses
  paymentMethod?: PaymentMethodInfo; // Cash vs specific Card
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  lastGeneratedDate?: string; // YYYY-MM-DD format of last generated recurring instance
  recurringSourceId?: string; // Template expense ID for generated occurrences
  receiptUrl?: string; // Base64 data URL or photo link
  comments?: ExpenseComment[];
  notes?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface Settlement {
  id: string;
  fromUserId: UserId; // Payer of debt
  toUserId: UserId;   // Recipient of debt
  amountCents: number;
  status: 'completed' | 'reversed';
  /** Server-generated recommendation identity for idempotent confirmations. */
  recommendationId?: string;
  /** Ledger revision used to calculate the recommendation. */
  ledgerRevision?: number;
  /** Server-generated idempotency key for new cloud settlements. */
  idempotencyKey?: string;
  /** Auth UID that confirmed the settlement. */
  confirmedBy?: string;
  reversedAt?: string;
  reversedBy?: string;
  proofUrl?: string;  // Image URL/base64 of payment receipt (bKash/Nagad/bank slip)
  houseId?: string;
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

export interface CategoryBudget {
  category: Category;
  limitCents: number;
}
