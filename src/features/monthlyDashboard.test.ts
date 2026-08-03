import { describe, expect, it } from 'vitest';
import type { Expense, Settlement } from '../types';
import { filterDashboardMonth, getDashboardMonths, getSettlementMonthKey } from './monthlyDashboard';

const expense = (id: string, date: string): Expense => ({
  id,
  title: id,
  amountCents: 1000,
  paidBy: 'user-a',
  category: 'Other',
  date,
  splitMethod: 'equal',
  shares: [{ userId: 'user-a', amountCents: 1000 }],
  scope: 'household',
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`,
});

const settlement = (id: string, settledAt: string): Settlement => ({
  id,
  fromUserId: 'user-a',
  toUserId: 'user-b',
  amountCents: 500,
  status: 'completed',
  createdAt: settledAt,
  settledAt,
});

describe('dashboard month selection', () => {
  const expenses = [expense('august', '2026-08-03'), expense('july', '2026-07-31')];
  const settlements = [settlement('july-payment', '2026-07-15T10:00:00.000Z')];

  it('includes the current month and all historical expense/settlement months', () => {
    const months = getDashboardMonths(expenses, settlements, '2026-09');
    expect(months.slice(0, 3)).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(months).toHaveLength(24);
  });

  it('filters both expenses and settlements to the selected month', () => {
    const result = filterDashboardMonth(expenses, settlements, '2026-07');
    expect(result.expenses.map((item) => item.id)).toEqual(['july']);
    expect(result.settlements.map((item) => item.id)).toEqual(['july-payment']);
  });

  it('uses settledAt with createdAt as a legacy fallback', () => {
    expect(getSettlementMonthKey({ ...settlements[0], settledAt: '' })).toBe('2026-07');
  });

  it('offers empty months between the current month and historical data', () => {
    expect(getDashboardMonths([expense('may', '2026-05-01')], [], '2026-08').slice(0, 4)).toEqual([
      '2026-08', '2026-07', '2026-06', '2026-05',
    ]);
  });
});
