import { beforeEach, describe, expect, it } from 'vitest';
import type { Expense, Settlement, User } from '../types';
import {
  calculateEqualSplits,
  calculatePercentageSplits,
  validateCustomSplits,
} from '../utils/currency';
import { extractTotalFromOcrText, isPhoneNumberOrYear } from './ocrScanner';
import { generateDueRecurringExpenses } from './recurringEngine';
import { calculateNetBalances, calculateSimplifiedSettlements, LEGACY_USER } from './settlementEngine';
import { saveLocalCredential, verifyLocalCredential } from '../services/mockAuthDatabase';
import { houseStorageScope, loadExpenses, personalStorageScope, saveExpenses } from '../services/storage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

const users: User[] = [
  { id: 'a', name: 'A', color: '#000' },
  { id: 'b', name: 'B', color: '#111' },
  { id: 'c', name: 'C', color: '#222' },
];

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense-1',
  title: 'Groceries',
  amountCents: 10_000,
  paidBy: 'a',
  category: 'Groceries',
  date: '2026-01-01',
  splitMethod: 'equal',
  shares: [
    { userId: 'a', amountCents: 3334 },
    { userId: 'b', amountCents: 3333 },
    { userId: 'c', amountCents: 3333 },
  ],
  scope: 'household',
  houseId: 'house-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('financial split calculations', () => {
  it('preserves every cent in equal splits', () => {
    const result = calculateEqualSplits(10_000, ['a', 'b', 'c']);
    expect(result).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(10_000);
  });

  it('normalizes percentage totals within tolerance and preserves every cent', () => {
    const result = calculatePercentageSplits(10_005, { a: 33.3, b: 33.3, c: 33.3 });
    expect(result.is100Percent).toBe(true);
    expect(Object.values(result.shares).reduce((sum, value) => sum + value, 0)).toBe(10_005);
  });

  it('rejects custom shares that do not match the expense total', () => {
    expect(validateCustomSplits(1000, { a: 400, b: 599 })).toEqual({
      isValid: false,
      differenceCents: 1,
    });
  });
});

describe('settlement accounting', () => {
  it('computes zero-sum balances and at most N-1 transfers', () => {
    const balances = calculateNetBalances([expense()], [], users);
    expect(Object.values(balances).reduce((sum, value) => sum + value.netBalanceCents, 0)).toBe(0);
    const transfers = calculateSimplifiedSettlements(balances, users);
    expect(transfers).toHaveLength(2);
    expect(transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0)).toBe(6666);
  });

  it('applies and reverses completed settlements correctly', () => {
    const completed: Settlement = {
      id: 'settlement-1',
      fromUserId: 'b',
      toUserId: 'a',
      amountCents: 3333,
      status: 'completed',
      houseId: 'house-1',
      createdAt: '2026-01-02T00:00:00.000Z',
      settledAt: '2026-01-02T00:00:00.000Z',
    };
    expect(calculateNetBalances([expense()], [completed], users).b.netBalanceCents).toBe(0);
    expect(calculateNetBalances([expense()], [{ ...completed, status: 'reversed' }], users).b.netBalanceCents).toBe(-3333);
  });

  it('keeps departed-member balances visible to the solver', () => {
    const withDepartedShare = expense({
      shares: [
        { userId: 'a', amountCents: 5000 },
        { userId: 'departed-user', amountCents: 5000 },
      ],
    });
    const balances = calculateNetBalances([withDepartedShare], [], users);
    expect(balances[LEGACY_USER.id].netBalanceCents).toBe(-5000);
    const transfers = calculateSimplifiedSettlements(balances, users);
    expect(transfers.some((transfer) => transfer.fromUser.id === LEGACY_USER.id)).toBe(true);
  });
});

describe('recurring expense generation', () => {
  it('generates every missed occurrence once and keeps copies non-recurring', () => {
    const template = expense({ id: 'rent', date: '2026-01-31', isRecurring: true, recurringFrequency: 'monthly' });
    const first = generateDueRecurringExpenses([template], '2026-04-30', '2026-05-01T00:00:00.000Z');
    expect(first.generated.map((item) => item.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(first.generated.every((item) => !item.isRecurring && item.recurringSourceId === 'rent')).toBe(true);
    const second = generateDueRecurringExpenses(first.expenses, '2026-04-30', '2026-05-01T00:00:01.000Z');
    expect(second.generated).toHaveLength(0);
  });
});

describe('receipt text parsing', () => {
  it('prefers a labeled total and ignores phone numbers and years', () => {
    const text = 'Shop Name\nPhone 01712345678\nSubtotal 950.00\nGrand Total BDT 1000.50\n2026';
    expect(isPhoneNumberOrYear('01712345678')).toBe(true);
    expect(extractTotalFromOcrText(text)).toBe(100_050);
  });
});

describe('offline security and isolation', () => {
  it('stores a salted credential hash instead of a plaintext password', async () => {
    await saveLocalCredential('user-1', 'user@example.com', 'secret123');
    const stored = localStorage.getItem('home_finance_local_credentials_v1') || '';
    expect(stored).not.toContain('secret123');
    await expect(verifyLocalCredential('user@example.com', 'secret123')).resolves.toBe(true);
    await expect(verifyLocalCredential('user@example.com', 'wrong-password')).resolves.toBe(false);
  });

  it('keeps household and personal expense caches in separate namespaces', () => {
    const householdExpense = expense();
    const personalExpense = expense({
      id: 'personal-1',
      scope: 'personal',
      ownerId: 'a',
      paidBy: 'a',
      houseId: undefined,
      shares: [{ userId: 'a', amountCents: 10_000 }],
    });
    saveExpenses([householdExpense], houseStorageScope('house-1'));
    saveExpenses([personalExpense], personalStorageScope('a'));
    expect(loadExpenses(houseStorageScope('house-1')).map((item) => item.id)).toEqual(['expense-1']);
    expect(loadExpenses(personalStorageScope('a')).map((item) => item.id)).toEqual(['personal-1']);
  });
});
