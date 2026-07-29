import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Expense, Settlement, PaymentCard } from '../types';

/**
 * Listens for realtime changes to the Firestore `expenses` collection (optionally house-scoped).
 */
export const subscribeExpenses = (onUpdate: (expenses: Expense[]) => void, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'expenses');
    const q = houseId ? query(colRef, where('houseId', '==', houseId)) : colRef;

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

/**
 * Saves or updates an expense in Firestore.
 */
export const syncSaveExpense = async (expense: Expense, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'expenses', expense.id);
    const dataToSave = houseId ? { ...expense, houseId } : expense;
    await setDoc(docRef, dataToSave, { merge: true });
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

  try {
    const colRef = collection(db, 'settlements');
    const q = houseId ? query(colRef, where('houseId', '==', houseId)) : colRef;

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
  } catch (err) {
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
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (err) {
    console.warn('Firestore save settlement fallback:', err);
  }
};

/**
 * Listens for realtime changes to the Firestore `cards` collection (optionally house-scoped).
 */
export const subscribeCards = (onUpdate: (cards: PaymentCard[]) => void, houseId?: string | null) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'cards');
    const q = houseId ? query(colRef, where('houseId', '==', houseId)) : colRef;

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
  } catch (err) {
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
    await setDoc(docRef, dataToSave, { merge: true });
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
