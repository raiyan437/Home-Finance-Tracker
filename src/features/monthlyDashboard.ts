import type { Expense, Settlement } from '../types';
import { toLocalMonthKey } from '../utils/localDate';

const monthKeyFromDate = (value?: string): string | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? null;
};

export const getSettlementMonthKey = (settlement: Settlement): string | null =>
  monthKeyFromDate(settlement.settledAt || settlement.createdAt);

export const getDashboardMonths = (
  expenses: Expense[],
  settlements: Settlement[],
  currentMonth = toLocalMonthKey()
): string[] => {
  const months = new Set<string>([currentMonth]);
  expenses.forEach((expense) => {
    const month = monthKeyFromDate(expense.date);
    if (month) months.add(month);
  });
  settlements.forEach((settlement) => {
    const month = getSettlementMonthKey(settlement);
    if (month) months.add(month);
  });
  const ordered = [...months].sort();
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const toIndex = (key: string): number => {
    const [year, month] = key.split('-').map(Number);
    return year * 12 + month - 1;
  };
  const currentIndex = toIndex(currentMonth);
  const firstIndex = Math.min(toIndex(first), currentIndex - 23);
  const lastIndex = Math.max(toIndex(last), currentIndex);

  // Fill gaps so users can inspect a month with no transactions instead of
  // only being offered months that already contain data.
  if (lastIndex - firstIndex <= 600) {
    const completeRange: string[] = [];
    for (let index = lastIndex; index >= firstIndex; index -= 1) {
      const year = Math.floor(index / 12);
      const month = index % 12 + 1;
      completeRange.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return completeRange;
  }

  return ordered.reverse();
};

export const filterDashboardMonth = (
  expenses: Expense[],
  settlements: Settlement[],
  selectedMonth: string
): { expenses: Expense[]; settlements: Settlement[] } => ({
  expenses: expenses.filter((expense) => monthKeyFromDate(expense.date) === selectedMonth),
  settlements: settlements.filter((settlement) => getSettlementMonthKey(settlement) === selectedMonth),
});
