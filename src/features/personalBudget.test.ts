import { describe, expect, it } from 'vitest';
import type { Expense } from '../types';
import { calculatePersonalBudgetUsage } from './personalBudget';

const expense = (id: string, date: string, amountCents: number, paymentType: 'cash' | 'card'): Expense => ({
  id,
  title: id,
  amountCents,
  paidBy: 'user-a',
  ownerId: 'user-a',
  scope: 'personal',
  category: 'Personal',
  date,
  splitMethod: 'equal',
  shares: [{ userId: 'user-a', amountCents }],
  paymentMethod: { type: paymentType },
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`,
});

describe('monthly personal budget', () => {
  it('counts cash and card expenses only in the selected month', () => {
    const expenses = [
      expense('july', '2026-07-31', 2_000, 'cash'),
      expense('august-cash', '2026-08-01', 3_000, 'cash'),
      expense('august-card', '2026-08-02', 4_000, 'card'),
    ];
    expect(calculatePersonalBudgetUsage(expenses, '2026-08', 10_000)).toEqual({
      isSet: true,
      usedCents: 7_000,
      targetCents: 10_000,
      ratioPercent: 70,
    });
  });

  it('updates immediately after an edit or deletion and distinguishes zero from unset', () => {
    const original = expense('expense', '2026-08-01', 5_000, 'cash');
    expect(calculatePersonalBudgetUsage([original], '2026-08', 10_000).usedCents).toBe(5_000);
    expect(calculatePersonalBudgetUsage([{ ...original, amountCents: 2_000, shares: [{ userId: 'user-a', amountCents: 2_000 }] }], '2026-08', 10_000).usedCents).toBe(2_000);
    expect(calculatePersonalBudgetUsage([], '2026-08', 10_000).usedCents).toBe(0);
    expect(calculatePersonalBudgetUsage([], '2026-08', 0)).toMatchObject({ isSet: true, targetCents: 0, ratioPercent: 0 });
    expect(calculatePersonalBudgetUsage([], '2026-08', undefined)).toMatchObject({ isSet: false, ratioPercent: 0 });
  });
});
