import type { Expense, Settlement, PaymentCard } from '../types';

const EXPENSES_STORAGE_KEY = 'home_finance_expenses_v1';
const SETTLEMENTS_STORAGE_KEY = 'home_finance_settlements_v1';
const CARDS_STORAGE_KEY = 'home_finance_cards_v1';

export const SEED_CARDS: PaymentCard[] = [];
export const SEED_EXPENSES: Expense[] = [];

export const loadExpenses = (): Expense[] => {
  try {
    const data = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!data) {
      saveExpenses([]);
      return [];
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load expenses from localStorage', err);
    return [];
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
      saveCards([]);
      return [];
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load cards from localStorage', err);
    return [];
  }
};

export const saveCards = (cards: PaymentCard[]): void => {
  try {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (err) {
    console.error('Failed to save cards to localStorage', err);
  }
};

export const clearAllFinancialData = (): void => {
  localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem(SETTLEMENTS_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify([]));
  localStorage.removeItem('home_finance_personal_budget_v1');
  localStorage.removeItem('home_finance_category_budgets_v1');
};

export const resetToSeedData = (): { expenses: Expense[]; settlements: Settlement[]; cards: PaymentCard[] } => {
  clearAllFinancialData();
  return { expenses: [], settlements: [], cards: [] };
};

export interface BackupDataPayload {
  version: string;
  exportedAt: string;
  expenses: Expense[];
  settlements: Settlement[];
  cards: PaymentCard[];
  usersDB?: any[];
  housesDB?: any[];
  personalBudgetTaka?: number;
  categoryBudgets?: Record<string, number>;
}

export const exportBackupJSON = (): string => {
  const rawUsers = JSON.parse(localStorage.getItem('home_finance_users_db_v3') || '[]');
  const sanitizedUsers = Array.isArray(rawUsers)
    ? rawUsers.map(({ password, ...u }: any) => u)
    : [];

  const payload: BackupDataPayload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    expenses: loadExpenses(),
    settlements: loadSettlements(),
    cards: loadCards(),
    usersDB: sanitizedUsers,
    housesDB: JSON.parse(localStorage.getItem('home_finance_houses_db_v3') || '[]'),
    personalBudgetTaka: Number(localStorage.getItem('home_finance_personal_budget_v1')) || 15000,
    categoryBudgets: JSON.parse(localStorage.getItem('home_finance_category_budgets_v1') || '{}'),
  };
  return JSON.stringify(payload, null, 2);
};

export const importBackupJSON = (jsonStr: string): boolean => {
  try {
    const data: BackupDataPayload = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.expenses)) {
      saveExpenses(data.expenses);
    }
    if (Array.isArray(data.settlements)) {
      saveSettlements(data.settlements);
    }
    if (Array.isArray(data.cards)) {
      saveCards(data.cards);
    }
    if (Array.isArray(data.usersDB) && data.usersDB.length > 0) {
      localStorage.setItem('home_finance_users_db_v3', JSON.stringify(data.usersDB));
    }
    if (Array.isArray(data.housesDB) && data.housesDB.length > 0) {
      localStorage.setItem('home_finance_houses_db_v3', JSON.stringify(data.housesDB));
    }
    if (data.personalBudgetTaka) {
      localStorage.setItem('home_finance_personal_budget_v1', String(data.personalBudgetTaka));
    }
    if (data.categoryBudgets) {
      localStorage.setItem('home_finance_category_budgets_v1', JSON.stringify(data.categoryBudgets));
    }
    return true;
  } catch (err) {
    console.error('Failed to import JSON backup payload:', err);
    return false;
  }
};
