import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, deleteField } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Expense, Settlement, PaymentCard, UserProfile, House } from '../types';

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
  try {
    const docRef = doc(db, 'users', userProfile.uid);
    const { password: _removedPassword, ...safeProfile } = userProfile as UserProfile & { password?: string };
    await setDoc(docRef, { ...sanitizeForFirestore(safeProfile), password: deleteField() }, { merge: true });
  } catch (err) {
    console.warn('Firestore save user fallback:', err);
  }
};

/**
 * Saves a house document in Firestore `houses` collection.
 */
export const syncSaveHouse = async (house: House) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const normalizedHouse: House = {
      ...house,
      memberUids: house.members.map((member) => member.uid),
      publicJoin: house.publicJoin !== false,
    };
    const docRef = doc(db, 'houses', house.id);
    await setDoc(docRef, sanitizeForFirestore(normalizedHouse), { merge: true });
    await setDoc(
      doc(db, 'houseCodes', house.code.toUpperCase()),
      sanitizeForFirestore({ houseId: house.id, name: house.name, leaderUid: house.leaderUid }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore save house fallback:', err);
  }
};

/**
 * Listens for realtime changes to a specific house document in Firestore `houses` collection.
 */
export const subscribeHouse = (houseId: string, onUpdate: (house: House | null) => void) => {
  if (!isFirebaseConfigured || !db || !houseId) return () => {};

  try {
    return onSnapshot(
      doc(db, 'houses', houseId),
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as House);
        }
      },
      (err) => console.warn('Firestore House Sync Warning:', err)
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
    const q = query(colRef, where('houseId', '==', houseId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Expense);
        });
        onUpdate(list);
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
    const q = query(collection(db, 'expenses'), where('ownerId', '==', ownerId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((snapshotDoc) => {
          const expense = snapshotDoc.data() as Expense;
          if (expense.scope === 'personal') list.push(expense);
        });
        onUpdate(list);
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
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'expenses', expense.id);
    const dataToSave = houseId ? { ...expense, houseId } : expense;
    await setDoc(docRef, sanitizeForFirestore(dataToSave), { merge: true });
  } catch (err) {
    console.warn('Firestore save expense fallback:', err);
  }
};

/**
 * Deletes an expense from Firestore.
 */
export const syncDeleteExpense = async (expenseId: string) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
  } catch (err) {
    console.warn('Firestore delete expense fallback:', err);
  }
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
        onUpdate(list);
      },
      (err) => console.warn('Firestore Settlements Sync Warning:', err)
    );
  } catch {
    return () => {};
  }
};

export const subscribeToExpenses = subscribeExpenses;
export const subscribeToSettlements = subscribeSettlements;

/**
 * Saves a settlement in Firestore.
 */
export const syncSaveSettlement = async (settlement: Settlement, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'settlements', settlement.id);
    const dataToSave = houseId ? { ...settlement, houseId } : settlement;
    await setDoc(docRef, sanitizeForFirestore(dataToSave), { merge: true });
  } catch (err) {
    console.warn('Firestore save settlement fallback:', err);
  }
};

/**
 * Deletes a settlement from Firestore.
 */
export const syncDeleteSettlement = async (settlementId: string) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, 'settlements', settlementId));
  } catch (err) {
    console.warn('Firestore delete settlement fallback:', err);
  }
};

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
        onUpdate(list);
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
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'cards', card.id);
    const dataToSave = houseId ? { ...card, houseId } : card;
    await setDoc(docRef, sanitizeForFirestore(dataToSave), { merge: true });
  } catch (err) {
    console.warn('Firestore save card fallback:', err);
  }
};

/**
 * Deletes a card from Firestore.
 */
export const syncDeleteCard = async (cardId: string) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, 'cards', cardId));
  } catch (err) {
    console.warn('Firestore delete card fallback:', err);
  }
};
