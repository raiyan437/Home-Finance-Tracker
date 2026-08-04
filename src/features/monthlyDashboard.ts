import type { Expense, Settlement } from '../types';
import { toLocalMonthKey } from '../utils/localDate';

const monthKeyFromDate = (value?: string): string | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? null;
};

export const getSettlementMonthKey = (settlement: Settlement): string | null =>
  monthKeyFromDate(settlement.settledAt || settlement.createdAt);

const parseMonthKey = (monthKey: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
};

/** The final calendar date used for an inclusive month-end ledger query. */
export const getMonthEndDateKey = (monthKey: string): string => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export const getMonthEndTimestamp = (monthKey: string): number => {
  const dateKey = getMonthEndDateKey(monthKey);
  const timestamp = Date.parse(`${dateKey}T23:59:59.999Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export const getSettlementCompletionTimestamp = (settlement: Settlement): number => {
  const timestamp = Date.parse(settlement.settledAt || settlement.createdAt || '');
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

/**
 * A completed payment affects the ledger from its completion time until its
 * reversal time. Reversed records remain in the audit log but are not applied
 * after the reversal became effective. Legacy reversed records without a
 * reversal timestamp are conservatively excluded from every as-of ledger.
 */
export const settlementWasActiveAt = (settlement: Settlement, boundaryTimestamp: number): boolean => {
  if (getSettlementCompletionTimestamp(settlement) > boundaryTimestamp) return false;
  if (settlement.status === 'reversed') {
    const reversedAt = Date.parse(settlement.reversedAt || '');
    return Number.isFinite(reversedAt) && reversedAt > boundaryTimestamp;
  }
  const reversedAt = Date.parse(settlement.reversedAt || '');
  return !Number.isFinite(reversedAt) || reversedAt > boundaryTimestamp;
};

export interface AsOfLedgerData {
  expenses: Expense[];
  settlements: Settlement[];
  boundaryDate: string;
}

/**
 * Returns the household ledger that was true at the end of the selected
 * month. This is intentionally different from the selected-month spend view:
 * old expenses remain part of cumulative debt while only period expenses are
 * shown in monthly cards and charts.
 */
export const getHouseholdLedgerAsOfMonth = (
  expenses: Expense[],
  settlements: Settlement[],
  selectedMonth: string,
): AsOfLedgerData => {
  const boundaryDate = getMonthEndDateKey(selectedMonth);
  const boundaryTimestamp = getMonthEndTimestamp(selectedMonth);
  return {
    expenses: expenses.filter((expense) => {
      if (expense.scope === 'personal') return false;
      return Boolean(expense.date) && expense.date <= boundaryDate;
    }),
    settlements: settlements.filter((settlement) => settlementWasActiveAt(settlement, boundaryTimestamp)),
    boundaryDate,
  };
};

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
    const reversalMonth = monthKeyFromDate(settlement.reversedAt);
    if (reversalMonth) months.add(reversalMonth);
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
