import type { Expense } from '../types';

export interface PersonalBudgetUsage {
  isSet: boolean;
  usedCents: number;
  targetCents?: number;
  ratioPercent: number;
}

/** Budget usage is period-only and includes both cash and card purchases. */
export const calculatePersonalBudgetUsage = (
  expenses: Expense[],
  selectedMonth: string,
  targetCents?: number,
): PersonalBudgetUsage => {
  const usedCents = expenses
    .filter((expense) => expense.scope === 'personal' && expense.date.startsWith(selectedMonth))
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  return {
    isSet: targetCents !== undefined,
    usedCents,
    ...(targetCents === undefined ? {} : { targetCents }),
    ratioPercent: targetCents !== undefined && targetCents > 0 ? (usedCents * 100) / targetCents : 0,
  };
};
