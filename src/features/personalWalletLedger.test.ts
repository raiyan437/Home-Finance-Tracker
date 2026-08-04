import { describe, expect, it } from 'vitest';
import type { Expense } from '../types';
import { calculateCashInHandCents, createCashCheckpoint, createCashOpeningBalance } from './personalWalletLedger';

const personalExpense = (id: string, amountCents: number, date: string, paymentMethod: 'cash' | 'card' = 'cash'): Expense => ({
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
  paymentMethod: { type: paymentMethod },
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`,
});

describe('personal wallet cash ledger', () => {
  it('starts at the cash amount saved by the user', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 12_000)).toBe(50_000);
  });

  it('deducts expenses added after the cash checkpoint', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 17_500)).toBe(44_500);
  });

  it('reconciles edited and deleted expenses without double-deducting', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 10_000)).toBe(52_000);
  });

  it('distinguishes an unset cash balance from a zero balance', () => {
    expect(calculateCashInHandCents(undefined, 10_000)).toBeNull();
    expect(calculateCashInHandCents({ cashBalanceCents: 0, cashTrackedExpenseCents: 0 }, 10_000)).toBe(-10_000);
  });

  it('derives a cash ledger from an opening balance and excludes card spending', () => {
    const settings = createCashOpeningBalance(50_000, '2026-07-15T12:00:00.000Z');
    const expenses = [
      personalExpense('before-opening', 9_000, '2026-07-01'),
      personalExpense('cash-after-opening', 2_500, '2026-07-16'),
      personalExpense('card-after-opening', 7_500, '2026-07-17', 'card'),
    ];
    expect(calculateCashInHandCents(settings, expenses)).toBe(47_500);
  });

  it('reconciles create, edit, delete, and cash/card switching from current records', () => {
    const settings = createCashOpeningBalance(10_000, '2026-07-01T00:00:00.000Z');
    const cash = personalExpense('expense', 2_000, '2026-07-10');
    expect(calculateCashInHandCents(settings, [cash])).toBe(8_000);
    expect(calculateCashInHandCents(settings, [{ ...cash, amountCents: 3_500, shares: [{ userId: 'user-a', amountCents: 3_500 }] }])).toBe(6_500);
    expect(calculateCashInHandCents(settings, [])).toBe(10_000);
    expect(calculateCashInHandCents(settings, [{ ...cash, paymentMethod: { type: 'card' } }])).toBe(10_000);
  });

  it('allows zero and negative displayed cash while keeping unset distinct', () => {
    const settings = createCashOpeningBalance(0, '2026-07-01T00:00:00.000Z');
    expect(calculateCashInHandCents(settings, [])).toBe(0);
    expect(calculateCashInHandCents(settings, [personalExpense('overspend', 1, '2026-07-02')])).toBe(-1);
    expect(calculateCashInHandCents(undefined, [])).toBeNull();
  });
});
