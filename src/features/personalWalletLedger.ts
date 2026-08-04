import type { Expense, PersonalWalletSettings } from '../types';

export interface CashLedgerEntry {
  id: string;
  type: 'opening-balance' | 'expense-debit';
  amountCents: number;
  effectiveAt: string;
  expenseId?: string;
}

const isIntegerCents = (value: unknown): value is number => Number.isSafeInteger(value);

/** Missing payment method is a legacy cash record; only an explicit card is excluded. */
export const isCashExpense = (expense: Expense): boolean => (
  expense.paymentMethod?.type !== 'card' && !expense.paymentMethod?.cardId
);

const expenseIsAfterOpening = (expense: Expense, openingAt: string): boolean => {
  const openingDate = openingAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(openingDate) && expense.date >= openingDate;
};

/**
 * Builds the deterministic cash ledger from the shared cloud records. The
 * ledger is intentionally derived, so edits, deletes, and cash/card switches
 * automatically become the corresponding correction without double counting.
 */
export const buildCashLedger = (
  settings: PersonalWalletSettings | undefined,
  expenses: Expense[],
): CashLedgerEntry[] => {
  if (!settings || !isIntegerCents(settings.cashOpeningBalanceCents) || !settings.cashOpeningAt) return [];
  const entries: CashLedgerEntry[] = [{
    id: 'cash-opening-balance',
    type: 'opening-balance',
    amountCents: settings.cashOpeningBalanceCents,
    effectiveAt: settings.cashOpeningAt,
  }];

  expenses
    .filter((expense) => expense.scope === 'personal' && isCashExpense(expense))
    .filter((expense) => expenseIsAfterOpening(expense, settings.cashOpeningAt || ''))
    .forEach((expense) => entries.push({
      id: `cash-expense-${expense.id}`,
      type: 'expense-debit',
      amountCents: -expense.amountCents,
      effectiveAt: expense.date,
      expenseId: expense.id,
    }));

  return entries;
};

/**
 * Returns cash in hand in integer cents. New profiles use the timestamped
 * opening model. The numeric overload is retained only for reading legacy
 * checkpoints created before Phase 3; new writes never use that lifetime
 * total model.
 */
export const calculateCashInHandCents = (
  settings: PersonalWalletSettings | undefined,
  expensesOrLegacyTotal: Expense[] | number,
): number | null => {
  if (!settings) return null;

  if (Array.isArray(expensesOrLegacyTotal)
    && isIntegerCents(settings.cashOpeningBalanceCents)
    && typeof settings.cashOpeningAt === 'string') {
    return buildCashLedger(settings, expensesOrLegacyTotal)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
  }

  // Compatibility path for old profiles. It is deliberately unreachable for
  // new checkpoint writes, but prevents a migration from changing old data's
  // displayed cash before the user chooses a new opening balance.
  if (!isIntegerCents(settings.cashBalanceCents)) return null;
  const totalPersonalExpenseCents = Array.isArray(expensesOrLegacyTotal)
    ? expensesOrLegacyTotal.reduce((sum, expense) => sum + expense.amountCents, 0)
    : expensesOrLegacyTotal;
  const trackedExpenseCents = settings.cashTrackedExpenseCents ?? totalPersonalExpenseCents;
  return settings.cashBalanceCents - (totalPersonalExpenseCents - trackedExpenseCents);
};

export const createCashOpeningBalance = (
  cashOpeningBalanceCents: number,
  cashOpeningAt = new Date().toISOString(),
): Pick<PersonalWalletSettings, 'cashOpeningBalanceCents' | 'cashOpeningAt'> => ({
  cashOpeningBalanceCents,
  cashOpeningAt,
});

/** Legacy export kept for backup/profile compatibility tests and old callers. */
export const createCashCheckpoint = (
  cashBalanceCents: number,
  totalPersonalExpenseCents: number,
): Pick<PersonalWalletSettings, 'cashBalanceCents' | 'cashTrackedExpenseCents'> => ({
  cashBalanceCents,
  cashTrackedExpenseCents: totalPersonalExpenseCents,
});
