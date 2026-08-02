import type { Expense, Settlement, PaymentCard, UserProfile } from '../types';

const EXPENSES_STORAGE_KEY = 'home_finance_expenses_v1';
const SETTLEMENTS_STORAGE_KEY = 'home_finance_settlements_v1';
const CARDS_STORAGE_KEY = 'home_finance_cards_v1';

export const houseStorageScope = (houseId: string): string => `house:${houseId}`;
export const personalStorageScope = (userId: string): string => `personal:${userId}`;
const scopedKey = (baseKey: string, scope?: string): string => (scope ? `${baseKey}:${scope}` : baseKey);

const legacyExpensesForScope = (expenses: Expense[], scope?: string): Expense[] => {
  if (!scope) return expenses;
  if (scope.startsWith('house:')) {
    const houseId = scope.slice('house:'.length);
    return expenses.filter((expense) => expense.scope !== 'personal' && expense.houseId === houseId);
  }
  if (scope.startsWith('personal:')) {
    const userId = scope.slice('personal:'.length);
    return expenses.filter(
      (expense) => expense.scope === 'personal' && (expense.ownerId === userId || expense.paidBy === userId)
    );
  }
  return [];
};

export const SEED_CARDS: PaymentCard[] = [];
export const SEED_EXPENSES: Expense[] = [];

export const loadExpenses = (scope?: string): Expense[] => {
  try {
    const key = scopedKey(EXPENSES_STORAGE_KEY, scope);
    const data = localStorage.getItem(key);
    if (!data) {
      const legacy = legacyExpensesForScope(JSON.parse(localStorage.getItem(EXPENSES_STORAGE_KEY) || '[]'), scope);
      saveExpenses(legacy, scope);
      return legacy;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load expenses from localStorage', err);
    return [];
  }
};

export const saveExpenses = (expenses: Expense[], scope?: string): void => {
  try {
    localStorage.setItem(scopedKey(EXPENSES_STORAGE_KEY, scope), JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to save expenses to localStorage', err);
  }
};

export const loadSettlements = (scope?: string): Settlement[] => {
  try {
    const key = scopedKey(SETTLEMENTS_STORAGE_KEY, scope);
    const data = localStorage.getItem(key);
    if (!data) {
      const legacy: Settlement[] = JSON.parse(localStorage.getItem(SETTLEMENTS_STORAGE_KEY) || '[]');
      const houseId = scope?.startsWith('house:') ? scope.slice('house:'.length) : null;
      const migrated = houseId ? legacy.filter((settlement) => settlement.houseId === houseId) : [];
      saveSettlements(migrated, scope);
      return migrated;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load settlements from localStorage', err);
    return [];
  }
};

export const saveSettlements = (settlements: Settlement[], scope?: string): void => {
  try {
    localStorage.setItem(scopedKey(SETTLEMENTS_STORAGE_KEY, scope), JSON.stringify(settlements));
  } catch (err) {
    console.error('Failed to save settlements to localStorage', err);
  }
};

export const loadCards = (scope?: string): PaymentCard[] => {
  try {
    const key = scopedKey(CARDS_STORAGE_KEY, scope);
    const data = localStorage.getItem(key);
    if (!data) {
      const legacy: PaymentCard[] = JSON.parse(localStorage.getItem(CARDS_STORAGE_KEY) || '[]');
      const ownerId = scope?.startsWith('personal:') ? scope.slice('personal:'.length) : null;
      const migrated = ownerId ? legacy.filter((card) => card.ownerId === ownerId) : [];
      saveCards(migrated, scope);
      return migrated;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load cards from localStorage', err);
    return [];
  }
};

export const saveCards = (cards: PaymentCard[], scope?: string): void => {
  try {
    localStorage.setItem(scopedKey(CARDS_STORAGE_KEY, scope), JSON.stringify(cards));
  } catch (err) {
    console.error('Failed to save cards to localStorage', err);
  }
};

export const clearAllFinancialData = (houseScope?: string, userScope?: string): void => {
  if (houseScope) {
    localStorage.setItem(scopedKey(EXPENSES_STORAGE_KEY, houseScope), JSON.stringify([]));
    localStorage.setItem(scopedKey(SETTLEMENTS_STORAGE_KEY, houseScope), JSON.stringify([]));
  }
  if (userScope) {
    localStorage.setItem(scopedKey(EXPENSES_STORAGE_KEY, userScope), JSON.stringify([]));
    localStorage.setItem(scopedKey(CARDS_STORAGE_KEY, userScope), JSON.stringify([]));
    const userId = userScope.startsWith('personal:') ? userScope.slice('personal:'.length) : userScope;
    localStorage.removeItem(`home_finance_personal_budget_v1_${userId}`);
    localStorage.removeItem(`home_finance_category_budgets_v1_${userId}`);
  }
  if (!houseScope && !userScope) {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(SETTLEMENTS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify([]));
  }
  if (!userScope) {
    localStorage.removeItem('home_finance_personal_budget_v1');
    localStorage.removeItem('home_finance_category_budgets_v1');
  }
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

export const exportBackupJSON = (houseId?: string, userId?: string): string => {
  const rawUsers = JSON.parse(localStorage.getItem('home_finance_users_db_v3') || '[]');
  const sanitizedUsers = Array.isArray(rawUsers)
    ? rawUsers.map((user: UserProfile & { password?: string }) => {
        const profile = { ...user };
        delete profile.password;
        return profile;
      })
    : [];

  const payload: BackupDataPayload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    expenses: [
      ...(houseId ? loadExpenses(houseStorageScope(houseId)) : []),
      ...(userId ? loadExpenses(personalStorageScope(userId)) : []),
    ],
    settlements: houseId ? loadSettlements(houseStorageScope(houseId)) : [],
    cards: userId ? loadCards(personalStorageScope(userId)) : [],
    usersDB: userId ? sanitizedUsers.filter((user: UserProfile) => user.uid === userId) : [],
    housesDB: houseId
      ? JSON.parse(localStorage.getItem('home_finance_houses_db_v3') || '[]').filter((house: { id: string }) => house.id === houseId)
      : [],
    personalBudgetTaka: Number(localStorage.getItem(`home_finance_personal_budget_v1_${userId}`)) || 15000,
    categoryBudgets: JSON.parse(localStorage.getItem(`home_finance_category_budgets_v1_${userId}`) || '{}'),
  };
  return JSON.stringify(payload, null, 2);
};

export const importBackupJSON = (jsonStr: string, houseId?: string, userId?: string): boolean => {
  try {
    const data: BackupDataPayload = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.expenses)) {
      if (houseId) {
        saveExpenses(
          data.expenses.filter((expense) => expense.scope !== 'personal' && expense.houseId === houseId),
          houseStorageScope(houseId)
        );
      }
      if (userId) {
        saveExpenses(
          data.expenses.filter((expense) => expense.scope === 'personal' && expense.ownerId === userId),
          personalStorageScope(userId)
        );
      }
    }
    if (Array.isArray(data.settlements) && houseId) {
      saveSettlements(data.settlements.filter((settlement) => settlement.houseId === houseId), houseStorageScope(houseId));
    }
    if (Array.isArray(data.cards) && userId) {
      saveCards(data.cards.filter((card) => card.ownerId === userId), personalStorageScope(userId));
    }
    if (data.personalBudgetTaka && userId) {
      localStorage.setItem(`home_finance_personal_budget_v1_${userId}`, String(data.personalBudgetTaka));
    }
    if (data.categoryBudgets && userId) {
      localStorage.setItem(`home_finance_category_budgets_v1_${userId}`, JSON.stringify(data.categoryBudgets));
    }
    return true;
  } catch (err) {
    console.error('Failed to import JSON backup payload:', err);
    return false;
  }
};
