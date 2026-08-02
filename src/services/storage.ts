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

export interface BackupImportResult {
  ok: boolean;
  data?: BackupDataPayload;
  error?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validBackupExpense = (value: unknown): value is Expense => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return false;
  if (!Number.isInteger(value.amountCents) || Number(value.amountCents) <= 0 || !Array.isArray(value.shares)) return false;
  const shares = value.shares as unknown[];
  return shares.length > 0 && shares.every((share) => isRecord(share) && typeof share.userId === 'string' && Number.isInteger(share.amountCents) && Number(share.amountCents) >= 0)
    && shares.reduce<number>((sum, share) => sum + Number((share as Record<string, unknown>).amountCents), 0) === value.amountCents;
};

const validBackupSettlement = (value: unknown): value is Settlement => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.fromUserId === 'string'
  && typeof value.toUserId === 'string'
  && value.fromUserId !== value.toUserId
  && Number.isInteger(value.amountCents)
  && Number(value.amountCents) > 0
  && (value.status === 'completed' || value.status === 'reversed');

const validBackupCard = (value: unknown): value is PaymentCard => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.bankName === 'string'
  && typeof value.createdAt === 'string';

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
    personalBudgetTaka: localStorage.getItem(`home_finance_personal_budget_v1_${userId}`) === null
      ? 15000
      : Number(localStorage.getItem(`home_finance_personal_budget_v1_${userId}`)),
    categoryBudgets: JSON.parse(localStorage.getItem(`home_finance_category_budgets_v1_${userId}`) || '{}'),
  };
  return JSON.stringify(payload, null, 2);
};

export const importBackupJSON = (jsonStr: string, houseId?: string, userId?: string): BackupImportResult => {
  try {
    const data = JSON.parse(jsonStr) as BackupDataPayload;
    if (!isRecord(data) || typeof data.version !== 'string') return { ok: false, error: 'Missing backup version.' };
    if (!Array.isArray(data.expenses) || !data.expenses.every(validBackupExpense)) return { ok: false, error: 'Backup contains invalid expenses.' };
    if (!Array.isArray(data.settlements) || !data.settlements.every(validBackupSettlement)) return { ok: false, error: 'Backup contains invalid settlements.' };
    if (!Array.isArray(data.cards) || !data.cards.every(validBackupCard)) return { ok: false, error: 'Backup contains invalid cards.' };

    const scopedExpenses = data.expenses.filter((expense) =>
      (houseId && expense.scope !== 'personal' && expense.houseId === houseId)
      || (userId && expense.scope === 'personal' && expense.ownerId === userId && expense.paidBy === userId)
    );
    const scopedSettlements = data.settlements.filter((settlement) => Boolean(houseId) && settlement.houseId === houseId);
    const scopedCards = data.cards.filter((card) => Boolean(userId) && card.ownerId === userId);
    const sanitizedData: BackupDataPayload = { ...data, expenses: scopedExpenses, settlements: scopedSettlements, cards: scopedCards };

    if (Array.isArray(data.expenses)) {
      if (houseId) {
        saveExpenses(
          scopedExpenses.filter((expense) => expense.scope !== 'personal' && expense.houseId === houseId),
          houseStorageScope(houseId)
        );
      }
      if (userId) {
        saveExpenses(
          scopedExpenses.filter((expense) => expense.scope === 'personal' && expense.ownerId === userId),
          personalStorageScope(userId)
        );
      }
    }
    if (Array.isArray(data.settlements) && houseId) {
      saveSettlements(scopedSettlements, houseStorageScope(houseId));
    }
    if (Array.isArray(data.cards) && userId) {
      saveCards(scopedCards, personalStorageScope(userId));
    }
    if (typeof data.personalBudgetTaka === 'number' && Number.isFinite(data.personalBudgetTaka) && data.personalBudgetTaka >= 0 && userId) {
      localStorage.setItem(`home_finance_personal_budget_v1_${userId}`, String(data.personalBudgetTaka));
    }
    if (data.categoryBudgets && userId) {
      localStorage.setItem(`home_finance_category_budgets_v1_${userId}`, JSON.stringify(data.categoryBudgets));
    }
    return { ok: true, data: sanitizedData };
  } catch (err) {
    console.error('Failed to import JSON backup payload:', err);
    return { ok: false, error: 'The selected file is not valid JSON.' };
  }
};
