import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense, PaymentCard } from '../types';
import type { PendingMutation } from './firebaseSync';

const { setDocMock, deleteDocMock, authState } = vi.hoisted(() => ({
  setDocMock: vi.fn().mockResolvedValue(undefined),
  deleteDocMock: vi.fn().mockResolvedValue(undefined),
  authState: { currentUser: { uid: 'user-a' }, app: {} },
}));

vi.mock('../config/firebase', () => ({
  auth: authState,
  db: {},
  functions: {},
  isFirebaseConfigured: true,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db: unknown, name: string) => ({ db, name })),
  deleteDoc: deleteDocMock,
  deleteField: vi.fn(() => ({ __deleteField: true })),
  doc: vi.fn((db: unknown, collectionName: string, id: string) => ({ db, collectionName, id })),
  onSnapshot: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  setDoc: setDocMock,
  where: vi.fn((...args: unknown[]) => args),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

import {
  classifyFirebaseError,
  coalesceMutations,
  flushSyncOutbox,
  getOutboxSnapshot,
  getSyncState,
  getPendingProfileOverlay,
  mergePending,
  MAX_OUTBOX_RETRIES,
  readOutbox,
  syncSaveCard,
  syncSaveExpense,
  syncSaveUserAvatar,
} from './firebaseSync';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const now = '2026-08-04T12:00:00.000Z';
const personalExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense-1',
  title: 'Groceries',
  amountCents: 1000,
  paidBy: 'user-a',
  category: 'Groceries',
  date: '2026-08-04',
  splitMethod: 'equal',
  shares: [{ userId: 'user-a', amountCents: 1000 }],
  scope: 'personal',
  ownerId: 'user-a',
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const asData = (expense: Expense): Record<string, unknown> => expense as unknown as Record<string, unknown>;

const outboxItem = (overrides: Partial<PendingMutation> = {}): PendingMutation => ({
  key: 'user-a/house-1/expenses/expense-1/document',
  mutationType: 'document',
  collection: 'expenses',
  id: 'expense-1',
  operation: 'set',
  data: asData(personalExpense({ scope: 'household', houseId: 'house-1' })),
  userUid: 'user-a',
  houseId: 'house-1',
  timestamp: now,
  retryCount: 0,
  maxRetries: MAX_OUTBOX_RETRIES,
  nextAttemptAt: now,
  mutationVersion: 1,
  status: 'pending',
  ...overrides,
});

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  setDocMock.mockReset().mockResolvedValue(undefined);
  deleteDocMock.mockReset().mockResolvedValue(undefined);
  authState.currentUser = { uid: 'user-a' };
});

describe('Firebase sync reliability policy', () => {
  it('classifies temporary, permanent, and session failures without exposing raw internals', () => {
    expect(classifyFirebaseError({ code: 'unavailable', message: 'secret endpoint details' })).toMatchObject({ kind: 'retryable', code: 'unavailable' });
    expect(classifyFirebaseError({ code: 'permission-denied', message: 'private rule expression' })).toMatchObject({ kind: 'permanent' });
    expect(classifyFirebaseError({ code: 'unauthenticated' })).toMatchObject({ kind: 'auth' });
    expect(classifyFirebaseError({ code: 'permission-denied', message: 'sensitive details' }).userMessage).not.toContain('sensitive');
  });

  it('coalesces compatible updates but preserves delete/set ordering', () => {
    const first = outboxItem({ mutationVersion: 1 });
    const second = outboxItem({ mutationVersion: 2, data: asData(personalExpense({ title: 'Updated' })) });
    const deletion = outboxItem({ mutationVersion: 3, operation: 'delete', data: undefined });
    const recreate = outboxItem({ mutationVersion: 4, data: asData(personalExpense({ title: 'Recreated' })) });
    expect(coalesceMutations([first, second])).toHaveLength(1);
    expect(coalesceMutations([first, deletion, recreate])).toHaveLength(3);
  });

  it('keeps queued work isolated by account and household', () => {
    localStorage.setItem('home_finance_sync_outbox_v2', JSON.stringify([
      outboxItem(),
      outboxItem({
        key: 'user-b/house-1/expenses/expense-2/document',
        id: 'expense-2',
        userUid: 'user-b',
        data: asData(personalExpense({ id: 'expense-2', scope: 'household', houseId: 'house-1', paidBy: 'user-b', ownerId: undefined })),
      }),
      outboxItem({
        key: 'user-a/house-2/expenses/expense-3/document',
        id: 'expense-3',
        userUid: 'user-a',
        houseId: 'house-2',
        data: asData(personalExpense({ id: 'expense-3', scope: 'household', houseId: 'house-2' })),
      }),
    ]));

    expect(getOutboxSnapshot('user-b', 'house-1').map((item) => item.id)).toEqual(['expense-2']);
    expect(mergePending('expenses', [personalExpense({ scope: 'household', houseId: 'house-1' })], 'user-b', 'house-1').map((item) => item.id)).toEqual(['expense-1', 'expense-2']);
    expect(mergePending('expenses', [personalExpense({ scope: 'household', houseId: 'house-1' })], 'user-a', 'house-1').map((item) => item.id)).toEqual(['expense-1']);
  });

  it('queues a temporary save and replays it after connectivity returns', async () => {
    setDocMock.mockRejectedValueOnce({ code: 'unavailable' });
    const queued = await syncSaveExpense(personalExpense());
    expect(queued.status).toBe('queued');
    expect(readOutbox()).toHaveLength(1);

    await flushSyncOutbox(true);
    expect(setDocMock).toHaveBeenCalledTimes(2);
    expect(readOutbox()).toHaveLength(0);
    expect(getSyncState('user-a').status).toBe('synced');
  });

  it('does not retry permission-denied writes and reports a failed state', async () => {
    setDocMock.mockRejectedValue({ code: 'permission-denied' });
    const failed = await syncSaveExpense(personalExpense());
    expect(failed.status).toBe('failed');
    expect(readOutbox().every((item) => item.status === 'failed')).toBe(true);
    await flushSyncOutbox(true);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(getSyncState('user-a')).toMatchObject({ status: 'failed', failedCount: 1, canRetry: false });
    expect(mergePending('expenses', [], 'user-a', undefined)).toEqual([]);
  });

  it('stops retrying after the configured limit', async () => {
    localStorage.setItem('home_finance_sync_outbox_v2', JSON.stringify([
      outboxItem({
        retryCount: MAX_OUTBOX_RETRIES,
        maxRetries: MAX_OUTBOX_RETRIES,
        houseId: undefined,
        data: asData(personalExpense()),
      }),
    ]));
    setDocMock.mockRejectedValue({ code: 'unavailable' });
    await flushSyncOutbox(true);
    expect(readOutbox()[0].status).toBe('failed');
    expect(readOutbox()[0].retryCount).toBe(MAX_OUTBOX_RETRIES + 1);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('uses full replacement for domain documents so removed optional fields stay removed', async () => {
    const expense = personalExpense({
      receiptUrl: undefined,
      notes: undefined,
      isRecurring: undefined,
      recurringFrequency: undefined,
      paymentMethod: { type: 'cash' },
    });
    await syncSaveExpense(expense);
    const [, payload, options] = setDocMock.mock.calls[0];
    expect(payload).not.toHaveProperty('receiptUrl');
    expect(payload).not.toHaveProperty('notes');
    expect(payload).not.toHaveProperty('recurringFrequency');
    expect(payload.paymentMethod).toEqual({ type: 'cash' });
    expect(options).toBeUndefined();

    const card: PaymentCard = { id: 'card-1', bankName: 'Bank', color: '#000', createdAt: now, ownerId: 'user-a' };
    await syncSaveCard(card);
    expect(setDocMock.mock.calls[1][1]).not.toHaveProperty('cardType');
  });

  it('keeps pending wallet/avatar fields over an older profile snapshot but never overlays membership', () => {
    localStorage.setItem('home_finance_sync_outbox_v2', JSON.stringify([
      {
        key: 'user-a/-/users/user-a/profile-wallet', mutationType: 'profile-wallet', collection: 'users', id: 'user-a', operation: 'set',
        data: { walletSettings: { monthlyBudgetCents: 5000 } }, userUid: 'user-a', timestamp: now, retryCount: 0, maxRetries: 5, nextAttemptAt: now, mutationVersion: 1, status: 'pending',
      },
      {
        key: 'user-a/-/users/user-a/profile-avatar', mutationType: 'profile-avatar', collection: 'users', id: 'user-a', operation: 'set',
        data: {}, deleteFields: ['avatar'], userUid: 'user-a', timestamp: now, retryCount: 0, maxRetries: 5, nextAttemptAt: now, mutationVersion: 2, status: 'pending',
      },
      {
        key: 'user-a/house-stale/users/user-a/profile-membership', mutationType: 'profile-membership', collection: 'users', id: 'user-a', operation: 'set',
        data: { houseId: 'house-stale', role: 'member' }, userUid: 'user-a', houseId: 'house-stale', timestamp: now, retryCount: 0, maxRetries: 5, nextAttemptAt: now, mutationVersion: 3, status: 'pending',
      },
    ]));
    const overlay = getPendingProfileOverlay('user-a', {
      uid: 'user-a', displayName: 'A', email: 'a@example.com', avatar: 'old-avatar', houseId: null, role: null, createdAt: now,
      walletSettings: { monthlyBudgetCents: 1000 },
    });
    expect(overlay.walletSettings).toEqual({ monthlyBudgetCents: 5000 });
    expect(overlay.avatar).toBeUndefined();
    expect(overlay.houseId).toBeNull();
  });

  it('uses an explicit field delete for profile avatar removal', async () => {
    await syncSaveUserAvatar('user-a', null);
    const [, payload, options] = setDocMock.mock.calls[0];
    expect(payload.avatar).toEqual({ __deleteField: true });
    expect(options).toEqual({ merge: true });
  });
});
