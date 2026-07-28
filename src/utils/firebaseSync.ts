import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Expense, Settlement, PaymentCard } from '../types';

/**
 * Listens for realtime changes to the Firestore `expenses` collection.
 */
export const subscribeExpenses = (onUpdate: (expenses: Expense[]) => void) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'expenses');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Expense);
        });
        if (list.length > 0) {
          onUpdate(list);
        }
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
export const syncSaveExpense = async (expense: Expense) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'expenses', expense.id);
    await setDoc(docRef, expense, { merge: true });
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
 * Listens for realtime changes to the Firestore `settlements` collection.
 */
export const subscribeSettlements = (onUpdate: (settlements: Settlement[]) => void) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'settlements');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: Settlement[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Settlement);
        });
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      (err) => console.warn('Firestore Settlements Sync Warning:', err)
    );
  } catch (err) {
    return () => {};
  }
};

/**
 * Saves a settlement in Firestore.
 */
export const syncSaveSettlement = async (settlement: Settlement) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'settlements', settlement.id);
    await setDoc(docRef, settlement, { merge: true });
  } catch (err) {
    console.warn('Firestore save settlement fallback:', err);
  }
};

/**
 * Listens for realtime changes to the Firestore `cards` collection.
 */
export const subscribeCards = (onUpdate: (cards: PaymentCard[]) => void) => {
  if (!isFirebaseConfigured || !db) return () => {};

  try {
    const colRef = collection(db, 'cards');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: PaymentCard[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as PaymentCard);
        });
        if (list.length > 0) {
          onUpdate(list);
        }
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
export const syncSaveCard = async (card: PaymentCard) => {
  if (!isFirebaseConfigured || !db) return;
  try {
    const docRef = doc(db, 'cards', card.id);
    await setDoc(docRef, card, { merge: true });
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
