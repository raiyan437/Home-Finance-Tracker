import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, deleteField, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, functions, isFirebaseConfigured } from '../config/firebase';
import type { Expense, ExpenseComment, Settlement, PaymentCard, UserProfile, House } from '../types';

type SyncCollection = 'users' | 'houses' | 'houseCodes' | 'expenses' | 'settlements' | 'cards';
type PendingMutation = {
  key: string;
  collection: SyncCollection;
  id: string;
  operation: 'set' | 'delete';
  data?: Record<string, unknown>;
  queuedAt: string;
};

export type SyncResult = { synced: boolean; queued: boolean };
const OUTBOX_KEY = 'home_finance_sync_outbox_v1';
let flushPromise: Promise<void> | null = null;

const readOutbox = (): PendingMutation[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOutbox = (items: PendingMutation[]): void => localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));

const enqueue = (mutation: Omit<PendingMutation, 'key' | 'queuedAt'>): void => {
  const key = `${mutation.collection}/${mutation.id}`;
  const next = readOutbox().filter((item) => item.key !== key);
  next.push({ ...mutation, key, queuedAt: new Date().toISOString() });
  writeOutbox(next);
};

const performMutation = async (mutation: PendingMutation): Promise<void> => {
  if (!db) throw new Error('Cloud database is unavailable.');
  const reference = doc(db, mutation.collection, mutation.id);
  const houseId = typeof mutation.data?.houseId === 'string' ? mutation.data.houseId : null;
  const affectsLedger = Boolean(houseId) && (mutation.collection === 'expenses' || mutation.collection === 'settlements');
  if (affectsLedger) {
    const callable = callableFunctions();
    if (!callable) throw new Error('Cloud ledger functions are unavailable.');
    await httpsCallable(callable, 'mutateHouseholdLedger')({
      collection: mutation.collection,
      operation: mutation.operation,
      id: mutation.id,
      houseId,
      ...(mutation.operation === 'set' ? { data: sanitizeForFirestore(mutation.data ?? {}) } : {}),
    });
  } else if (mutation.operation === 'delete') await deleteDoc(reference);
  else await setDoc(reference, sanitizeForFirestore(mutation.data ?? {}), { merge: true });
};

export const flushSyncOutbox = async (): Promise<void> => {
  if (!isFirebaseConfigured || !db || flushPromise) return flushPromise ?? Promise.resolve();
  flushPromise = (async () => {
    const pending = readOutbox();
    const failed: PendingMutation[] = [];
    for (const mutation of pending) {
      try {
        await performMutation(mutation);
      } catch {
        failed.push(mutation);
      }
    }
    writeOutbox(failed);
  })().finally(() => { flushPromise = null; });
  return flushPromise;
};

export const discardPendingUserProfileMutation = (uid: string): void => {
  writeOutbox(readOutbox().filter((item) => !(item.collection === 'users' && item.id === uid)));
};

const syncMutation = async (mutation: Omit<PendingMutation, 'key' | 'queuedAt'>): Promise<SyncResult> => {
  if (!isFirebaseConfigured || !db) return { synced: false, queued: false };
  try {
    await performMutation({ ...mutation, key: `${mutation.collection}/${mutation.id}`, queuedAt: new Date().toISOString() });
    const remaining = readOutbox().filter((item) => item.key !== `${mutation.collection}/${mutation.id}`);
    writeOutbox(remaining);
    return { synced: true, queued: false };
  } catch (error) {
    enqueue(mutation);
    console.error(`Cloud sync queued for retry (${mutation.collection}/${mutation.id}).`, error);
    return { synced: false, queued: true };
  }
};

const mergePending = <T extends { id: string }>(collectionName: SyncCollection, cloudItems: T[]): T[] => {
  const byId = new Map(cloudItems.map((item) => [item.id, item]));
  readOutbox().filter((item) => item.collection === collectionName).forEach((mutation) => {
    if (mutation.operation === 'delete') byId.delete(mutation.id);
    else byId.set(mutation.id, mutation.data as unknown as T);
  });
  return [...byId.values()];
};

/**
 * Recursively cleans objects to remove `undefined` properties or convert them to `null`
 * so Firestore setDoc/updateDoc never throws "Unsupported field value: undefined".
 */
export const sanitizeForFirestore = <T>(data: T): T => {
  if (data === null || data === undefined) return null as unknown as T;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as T;
};

/**
 * Saves a user profile document in Firestore `users` collection.
 */
export const syncSaveUser = async (userProfile: UserProfile) => {
  if (!isFirebaseConfigured || !db) return;
  const { password: _removedPassword, ...safeProfile } = userProfile as UserProfile & { password?: string };
  try {
    await setDoc(doc(db, 'users', userProfile.uid), { ...sanitizeForFirestore(safeProfile), password: deleteField() }, { merge: true });
    return { synced: true, queued: false } satisfies SyncResult;
  } catch (error) {
    enqueue({ collection: 'users', id: userProfile.uid, operation: 'set', data: safeProfile as unknown as Record<string, unknown> });
    console.error('User profile sync queued for retry.', error);
    return { synced: false, queued: true } satisfies SyncResult;
  }
};

/**
 * Saves a house document in Firestore `houses` collection.
 */
export const syncSaveHouse = async (house: House) => {
  if (!isFirebaseConfigured || !db) return;
  const normalizedHouse: House = {
      ...house,
      memberUids: house.members.map((member) => member.uid),
      memberMap: Object.fromEntries(house.members.map((member) => [member.uid, member])),
      publicJoin: house.publicJoin !== false,
  };
  if (!isFirebaseConfigured || !db) return;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'houses', house.id), sanitizeForFirestore(normalizedHouse), { merge: true });
    batch.set(doc(db, 'houseCodes', house.code.toUpperCase()), sanitizeForFirestore({ houseId: house.id, name: house.name, leaderUid: house.leaderUid }), { merge: true });
    await batch.commit();
    return { synced: true, queued: false } satisfies SyncResult;
  } catch (error) {
    enqueue({ collection: 'houses', id: house.id, operation: 'set', data: normalizedHouse as unknown as Record<string, unknown> });
    enqueue({ collection: 'houseCodes', id: house.code.toUpperCase(), operation: 'set', data: { houseId: house.id, name: house.name, leaderUid: house.leaderUid } });
    console.error('House sync queued for retry.', error);
    return { synced: false, queued: true } satisfies SyncResult;
  }
};

/**
 * Listens for realtime changes to a specific house document in Firestore `houses` collection.
 */
export const subscribeHouse = (
  houseId: string,
  onUpdate: (house: House | null) => void,
  onError?: (error: unknown) => void
) => {
  if (!isFirebaseConfigured || !db || !houseId) return () => {};

  try {
    return onSnapshot(
      doc(db, 'houses', houseId),
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as House);
        } else onUpdate(null);
      },
      (err) => {
        console.warn('Firestore House Sync Warning:', err);
        onError?.(err);
      }
    );
  } catch {
    return () => {};
  }
};

/**
 * Listens for realtime changes to the Firestore `expenses` collection (optionally house-scoped).
 */
export const subscribeExpenses = (onUpdate: (expenses: Expense[]) => void, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return () => {};

  if (!houseId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const colRef = collection(db, 'expenses');
    const q = query(
      colRef,
      where('houseId', '==', houseId),
      where('scope', '==', 'household')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Expense);
        });
        onUpdate(mergePending('expenses', list));
        void flushSyncOutbox();
      },
      (err) => console.warn('Firestore Expenses Sync Warning (using local storage fallback):', err)
    );
  } catch (err) {
    console.warn('Firestore Expenses init warning:', err);
    return () => {};
  }
};

/** Listens only to private expenses owned by the authenticated user. */
export const subscribePersonalExpenses = (onUpdate: (expenses: Expense[]) => void, ownerId?: string | null) => {
  if (!isFirebaseConfigured || !db) return () => {};
  if (!ownerId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'expenses'),
      where('ownerId', '==', ownerId),
      where('scope', '==', 'personal')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((snapshotDoc) => {
          const expense = snapshotDoc.data() as Expense;
          if (expense.scope === 'personal') list.push(expense);
        });
        onUpdate(mergePending('expenses', list));
        void flushSyncOutbox();
      },
      (err) => console.warn('Firestore Personal Expenses Sync Warning:', err)
    );
  } catch (err) {
    console.warn('Firestore Personal Expenses init warning:', err);
    return () => {};
  }
};

/**
 * Saves or updates an expense in Firestore.
 */
export const syncSaveExpense = async (expense: Expense, houseId?: string | null) => {
  const normalizedExpense = {
    ...expense,
    sharesTotalCents: expense.shares.reduce((sum, share) => sum + share.amountCents, 0),
    participantUids: expense.shares.map((share) => share.userId),
  };
  const dataToSave = houseId ? { ...normalizedExpense, houseId } : normalizedExpense;
  return syncMutation({ collection: 'expenses', id: expense.id, operation: 'set', data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown> });
};

/**
 * Deletes an expense from Firestore.
 */
export const syncDeleteExpense = async (expenseId: string) => {
  return syncMutation({ collection: 'expenses', id: expenseId, operation: 'delete' });
};

export const syncDeleteHouseExpense = async (expenseId: string, houseId: string) =>
  syncMutation({ collection: 'expenses', id: expenseId, operation: 'delete', data: { houseId } });

type CallableCommentResult = { synced: boolean };

const callableFunctions = () => {
  if (functions) return functions;
  if (auth?.app) return getFunctions(auth.app);
  return null;
};

/**
 * Embedded comments are mutated by the callable function so a client cannot
 * reorder or rewrite the surrounding expense while appending a comment.
 */
export const syncAddExpenseComment = async (expense: Expense, comment: ExpenseComment): Promise<SyncResult> => {
  if (!isFirebaseConfigured || !db) return { synced: false, queued: false };
  if (!auth?.currentUser || auth.currentUser.uid !== comment.userId) throw new Error('Comment author does not match the signed-in user.');
  const callable = callableFunctions();
  if (!callable) throw new Error('Cloud functions are unavailable.');
  await httpsCallable<{ expenseId: string; comment: ExpenseComment }, CallableCommentResult>(callable, 'addExpenseComment')({
    expenseId: expense.id,
    comment: sanitizeForFirestore(comment),
  });
  return { synced: true, queued: false };
};

export const syncDeleteExpenseComment = async (expense: Expense, commentId: string): Promise<SyncResult> => {
  if (!isFirebaseConfigured || !db) return { synced: false, queued: false };
  const callable = callableFunctions();
  if (!callable) throw new Error('Cloud functions are unavailable.');
  await httpsCallable<{ expenseId: string; commentId: string }, CallableCommentResult>(callable, 'deleteExpenseComment')({
    expenseId: expense.id,
    commentId,
  });
  return { synced: true, queued: false };
};

/**
 * Listens for realtime changes to the Firestore `settlements` collection (optionally house-scoped).
 */
export const subscribeSettlements = (onUpdate: (settlements: Settlement[]) => void, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return () => {};

  if (!houseId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const colRef = collection(db, 'settlements');
    const q = query(colRef, where('houseId', '==', houseId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Settlement[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Settlement);
        });
        onUpdate(mergePending('settlements', list));
        void flushSyncOutbox();
      },
      (err) => console.warn('Firestore Settlements Sync Warning:', err)
    );
  } catch {
    return () => {};
  }
};

/**
 * Saves a settlement in Firestore.
 */
export const syncSaveSettlement = async (settlement: Settlement, houseId?: string | null) => {
  // Completed settlements must come from the server-authoritative recommender.
  // This function remains for authorized reversal updates and offline mode.
  if (settlement.status === 'completed' && isFirebaseConfigured) return { synced: false, queued: false } satisfies SyncResult;
  const dataToSave = houseId ? { ...settlement, houseId } : settlement;
  return syncMutation({ collection: 'settlements', id: settlement.id, operation: 'set', data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown> });
};

export const syncConfirmSettlement = async (
  houseId: string,
  ledgerRevision: number,
  transaction: { id: string; fromUserId: string; toUserId: string; amountCents: number },
  proofUrl?: string
): Promise<Settlement> => {
  if (!isFirebaseConfigured || !db) throw new Error('Cloud settlement confirmation is unavailable.');
  const callable = callableFunctions();
  if (!callable) throw new Error('Cloud functions are unavailable.');
  const result = await httpsCallable<{
    houseId: string;
    expectedLedgerRevision: number;
    recommendationId: string;
    fromUserId: string;
    toUserId: string;
    amountCents: number;
    proofUrl?: string;
  }, { settlement: Settlement }>(callable, 'confirmSettlement')({
    houseId,
    expectedLedgerRevision: ledgerRevision,
    recommendationId: transaction.id,
    fromUserId: transaction.fromUserId,
    toUserId: transaction.toUserId,
    amountCents: transaction.amountCents,
    ...(proofUrl ? { proofUrl } : {}),
  });
  return result.data.settlement;
};

/**
 * Deletes a settlement from Firestore.
 */
export const syncDeleteSettlement = async (settlementId: string) => {
  return syncMutation({ collection: 'settlements', id: settlementId, operation: 'delete' });
};

export const syncDeleteHouseSettlement = async (settlementId: string, houseId: string) =>
  syncMutation({ collection: 'settlements', id: settlementId, operation: 'delete', data: { houseId } });

export const hasPendingLedgerMutations = (houseId: string): boolean => readOutbox().some((item) =>
  (item.collection === 'expenses' || item.collection === 'settlements') && item.data?.houseId === houseId
);

/**
 * Listens for realtime changes to the Firestore `cards` collection (household or owner-scoped).
 */
export const subscribeCards = (
  onUpdate: (cards: PaymentCard[]) => void,
  houseId?: string | null,
  ownerId?: string | null
) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'cards');
    let q;
    if (houseId) {
      q = query(colRef, where('houseId', '==', houseId));
    } else if (ownerId) {
      q = query(colRef, where('ownerId', '==', ownerId));
    } else {
      q = colRef;
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const list: PaymentCard[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as PaymentCard);
        });
        onUpdate(mergePending('cards', list));
        void flushSyncOutbox();
      },
      (err) => console.warn('Firestore Cards Sync Warning:', err)
    );
  } catch {
    return () => {};
  }
};

/**
 * Saves a card in Firestore.
 */
export const syncSaveCard = async (card: PaymentCard, houseId?: string | null) => {
  const dataToSave = houseId ? { ...card, houseId } : card;
  return syncMutation({ collection: 'cards', id: card.id, operation: 'set', data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown> });
};

/**
 * Deletes a card from Firestore.
 */
export const syncDeleteCard = async (cardId: string) => {
  return syncMutation({ collection: 'cards', id: cardId, operation: 'delete' });
};
