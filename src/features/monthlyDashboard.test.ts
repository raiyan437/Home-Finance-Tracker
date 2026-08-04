import { describe, expect, it } from 'vitest';
import type { Expense, Settlement } from '../types';
import { filterDashboardMonth, getDashboardMonths, getHouseholdLedgerAsOfMonth, getSettlementMonthKey } from './monthlyDashboard';
import { calculateNetBalances } from './settlementEngine';

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

  it('keeps monthly spend separate from cumulative debt across July and August', () => {
    const julyExpense = expense('july-debt', '2026-07-15');
    const sharedJulyExpense: Expense = {
      ...julyExpense,
      amountCents: 10_000,
      paidBy: 'user-a',
      shares: [
        { userId: 'user-a', amountCents: 5_000 },
        { userId: 'user-b', amountCents: 5_000 },
      ],
    };
    const augustPayment = settlement('august-payment', '2026-08-03T10:00:00.000Z');

    const july = getHouseholdLedgerAsOfMonth([sharedJulyExpense], [{ ...augustPayment, fromUserId: 'user-b', toUserId: 'user-a', amountCents: 5_000 }], '2026-07');
    const august = getHouseholdLedgerAsOfMonth([sharedJulyExpense], [{ ...augustPayment, fromUserId: 'user-b', toUserId: 'user-a', amountCents: 5_000 }], '2026-08');

    const julyBalances = calculateNetBalances(july.expenses, july.settlements, [
      { id: 'user-a', name: 'A', color: '#000' },
      { id: 'user-b', name: 'B', color: '#111' },
    ]);
    const augustBalances = calculateNetBalances(august.expenses, august.settlements, [
      { id: 'user-a', name: 'A', color: '#000' },
      { id: 'user-b', name: 'B', color: '#111' },
    ]);

    expect(july.expenses).toHaveLength(1);
    expect(july.settlements).toHaveLength(0);
    expect(julyBalances['user-a'].netBalanceCents).toBe(5_000);
    expect(julyBalances['user-b'].netBalanceCents).toBe(-5_000);
    expect(august.settlements).toHaveLength(1);
    expect(augustBalances['user-a'].netBalanceCents).toBe(0);
    expect(augustBalances['user-b'].netBalanceCents).toBe(0);
  });

  it('applies a settlement reversal exactly once at its effective timestamp', () => {
    const payment = {
      ...settlement('payment', '2026-08-03T10:00:00.000Z'),
      reversedAt: '2026-09-02T10:00:00.000Z',
      status: 'reversed' as const,
    };
    expect(getHouseholdLedgerAsOfMonth([], [payment], '2026-08').settlements).toHaveLength(1);
    expect(getHouseholdLedgerAsOfMonth([], [payment], '2026-09').settlements).toHaveLength(0);
  });
});
