import type { Expense, Settlement } from '../types';

const EXPENSES_STORAGE_KEY = 'home_finance_expenses_v1';
const SETTLEMENTS_STORAGE_KEY = 'home_finance_settlements_v1';

export const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp-101',
    title: 'Weekly Groceries',
    amountCents: 9000, // $90.00
    paidBy: 'raiyan',
    category: 'Groceries',
    date: '2026-07-20',
    splitMethod: 'equal',
    shares: [
      { userId: 'raiyan', amountCents: 3000 },
      { userId: 'himel', amountCents: 3000 },
      { userId: 'lazim', amountCents: 3000 },
    ],
    notes: 'Supermarket haul for household essentials',
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'exp-102',
    title: 'Household Supplies & Detergents',
    amountCents: 6000, // $60.00
    paidBy: 'himel',
    category: 'Household',
    date: '2026-07-22',
    splitMethod: 'equal',
    shares: [
      { userId: 'raiyan', amountCents: 2000 },
      { userId: 'himel', amountCents: 2000 },
      { userId: 'lazim', amountCents: 2000 },
    ],
    notes: 'Paper towels, dish soap, trash bags',
    createdAt: '2026-07-22T14:30:00.000Z',
    updatedAt: '2026-07-22T14:30:00.000Z',
  },
  {
    id: 'exp-103',
    title: 'Bathroom Cleaning Products',
    amountCents: 4500, // $45.00
    paidBy: 'lazim',
    category: 'Household',
    date: '2026-07-24',
    splitMethod: 'equal',
    shares: [
      { userId: 'raiyan', amountCents: 2250 },
      { userId: 'lazim', amountCents: 2250 },
    ],
    notes: 'Shared between Raiyan and Lazim',
    createdAt: '2026-07-24T16:15:00.000Z',
    updatedAt: '2026-07-24T16:15:00.000Z',
  },
  {
    id: 'exp-104',
    title: 'Desk Lamp for Himel',
    amountCents: 2500, // $25.00
    paidBy: 'raiyan',
    category: 'Personal',
    date: '2026-07-25',
    splitMethod: 'equal',
    shares: [{ userId: 'himel', amountCents: 2500 }],
    notes: 'Personal purchase made on behalf of Himel',
    createdAt: '2026-07-25T11:20:00.000Z',
    updatedAt: '2026-07-25T11:20:00.000Z',
  },
  {
    id: 'exp-105',
    title: 'Specialty Coffee Beans for Raiyan',
    amountCents: 1500, // $15.00
    paidBy: 'himel',
    category: 'Personal',
    date: '2026-07-26',
    splitMethod: 'equal',
    shares: [{ userId: 'raiyan', amountCents: 1500 }],
    notes: 'Personal item bought for Raiyan',
    createdAt: '2026-07-26T18:45:00.000Z',
    updatedAt: '2026-07-26T18:45:00.000Z',
  },
];

export const loadExpenses = (): Expense[] => {
  try {
    const data = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!data) {
      saveExpenses(SEED_EXPENSES);
      return SEED_EXPENSES;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load expenses from localStorage', err);
    return SEED_EXPENSES;
  }
};

export const saveExpenses = (expenses: Expense[]): void => {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to save expenses to localStorage', err);
  }
};

export const loadSettlements = (): Settlement[] => {
  try {
    const data = localStorage.getItem(SETTLEMENTS_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load settlements from localStorage', err);
    return [];
  }
};

export const saveSettlements = (settlements: Settlement[]): void => {
  try {
    localStorage.setItem(SETTLEMENTS_STORAGE_KEY, JSON.stringify(settlements));
  } catch (err) {
    console.error('Failed to save settlements to localStorage', err);
  }
};

export const resetToSeedData = (): { expenses: Expense[]; settlements: Settlement[] } => {
  saveExpenses(SEED_EXPENSES);
  saveSettlements([]);
  return { expenses: SEED_EXPENSES, settlements: [] };
};
