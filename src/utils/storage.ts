import type { Expense, Settlement, PaymentCard } from '../types';

const EXPENSES_STORAGE_KEY = 'home_finance_expenses_v1';
const SETTLEMENTS_STORAGE_KEY = 'home_finance_settlements_v1';
const CARDS_STORAGE_KEY = 'home_finance_cards_v1';

export const SEED_CARDS: PaymentCard[] = [
  {
    id: 'card-101',
    bankName: 'Chase Sapphire Visa',
    cardType: 'credit',
    color: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
    ownerId: 'raiyan',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'card-102',
    bankName: 'City Emerald Debit',
    cardType: 'debit',
    color: 'linear-gradient(135deg, #065f46, #10b981)',
    ownerId: 'himel',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'card-103',
    bankName: 'Amex Violet Preferred',
    cardType: 'credit',
    color: 'linear-gradient(135deg, #5b21b6, #8b5cf6)',
    ownerId: 'lazim',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

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
    paymentMethod: { type: 'card', cardId: 'card-101' },
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
    paymentMethod: { type: 'card', cardId: 'card-102' },
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
    paymentMethod: { type: 'cash' },
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
    paymentMethod: { type: 'card', cardId: 'card-101' },
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
    paymentMethod: { type: 'cash' },
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

export const loadCards = (): PaymentCard[] => {
  try {
    const data = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!data) {
      saveCards(SEED_CARDS);
      return SEED_CARDS;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load cards from localStorage', err);
    return SEED_CARDS;
  }
};

export const saveCards = (cards: PaymentCard[]): void => {
  try {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (err) {
    console.error('Failed to save cards to localStorage', err);
  }
};

export const resetToSeedData = (): { expenses: Expense[]; settlements: Settlement[]; cards: PaymentCard[] } => {
  saveExpenses(SEED_EXPENSES);
  saveSettlements([]);
  saveCards(SEED_CARDS);
  return { expenses: SEED_EXPENSES, settlements: [], cards: SEED_CARDS };
};
