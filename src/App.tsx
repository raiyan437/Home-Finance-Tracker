import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ExpenseList } from './components/ExpenseList';
import { SettlementView } from './components/SettlementView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AuthModal } from './components/AuthModal';
import { ConfirmModal } from './components/ConfirmModal';

import type { Expense, Settlement, SimplifiedTransaction, PaymentCard } from './types';
import {
  loadExpenses,
  saveExpenses,
  loadSettlements,
  saveSettlements,
  loadCards,
  saveCards,
  resetToSeedData,
} from './utils/storage';
import {
  subscribeExpenses,
  subscribeSettlements,
  subscribeCards,
  syncSaveExpense,
  syncDeleteExpense,
  syncSaveSettlement,
  syncSaveCard,
  syncDeleteCard,
} from './utils/firebaseSync';
import { calculateNetBalances, calculateSimplifiedSettlements } from './utils/settlementEngine';

// Code-split heavy views for instant page loads
const MonthlySummary = lazy(() =>
  import('./components/MonthlySummary').then((m) => ({ default: m.MonthlySummary }))
);
const PersonalWallet = lazy(() =>
  import('./components/PersonalWallet').then((m) => ({ default: m.PersonalWallet }))
);
const CardsManager = lazy(() =>
  import('./components/CardsManager').then((m) => ({ default: m.CardsManager }))
);

const AppContent: React.FC = () => {
  const { activeUserId } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [pendingSettlementTx, setPendingSettlementTx] = useState<SimplifiedTransaction | null>(null);

  // Initialize data, theme, and Firestore realtime subscriptions
  useEffect(() => {
    setExpenses(loadExpenses());
    setSettlements(loadSettlements());
    setCards(loadCards());

    const savedTheme = (localStorage.getItem('home_finance_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Subscribe to Firestore Realtime Updates when available
    const unsubExp = subscribeExpenses((fbExpenses) => {
      setExpenses(fbExpenses);
      saveExpenses(fbExpenses);
    });

    const unsubSt = subscribeSettlements((fbSettlements) => {
      setSettlements(fbSettlements);
      saveSettlements(fbSettlements);
    });

    const unsubCards = subscribeCards((fbCards) => {
      setCards(fbCards);
      saveCards(fbCards);
    });

    return () => {
      unsubExp();
      unsubSt();
      unsubCards();
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('home_finance_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Filter household shared expenses vs personal expenses
  const householdExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope !== 'personal');
  }, [expenses]);

  const personalExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope === 'personal' && e.ownerId === activeUserId);
  }, [expenses, activeUserId]);

  const userCards = useMemo(() => {
    return cards.filter((c) => !c.ownerId || c.ownerId === activeUserId);
  }, [cards, activeUserId]);

  // Calculate pending simplified settlements for household
  const userBalances = calculateNetBalances(householdExpenses, settlements);
  const pendingSettlementsCount = calculateSimplifiedSettlements(userBalances).length;

  // Add / Edit Expense handler
  const handleSaveExpense = (
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    const now = new Date().toISOString();

    if (editingId) {
      const target = expenses.find((e) => e.id === editingId);
      const updatedExpense: Expense = {
        ...(target || {}),
        ...expenseData,
        id: editingId,
        createdAt: target?.createdAt || now,
        updatedAt: now,
      };

      const updatedList = expenses.map((e) => (e.id === editingId ? updatedExpense : e));
      setExpenses(updatedList);
      saveExpenses(updatedList);
      syncSaveExpense(updatedExpense);
    } else {
      const newExpense: Expense = {
        ...expenseData,
        id: `exp-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      const updatedList = [newExpense, ...expenses];
      setExpenses(updatedList);
      saveExpenses(updatedList);
      syncSaveExpense(newExpense);
    }
  };

  // Delete Expense handler
  const handleDeleteExpenseConfirm = () => {
    if (!deletingExpenseId) return;
    const updated = expenses.filter((e) => e.id !== deletingExpenseId);
    setExpenses(updated);
    saveExpenses(updated);
    syncDeleteExpense(deletingExpenseId);
    setDeletingExpenseId(null);
  };

  // Card Management handlers
  const handleAddCard = (
    cardData: Omit<PaymentCard, 'id' | 'createdAt'>,
    editingId?: string
  ) => {
    const now = new Date().toISOString();
    if (editingId) {
      const target = cards.find((c) => c.id === editingId);
      const updatedCard: PaymentCard = {
        ...(target || {}),
        ...cardData,
        id: editingId,
        createdAt: target?.createdAt || now,
      };
      const updatedList = cards.map((c) => (c.id === editingId ? updatedCard : c));
      setCards(updatedList);
      saveCards(updatedList);
      syncSaveCard(updatedCard);
    } else {
      const newCard: PaymentCard = {
        ...cardData,
        id: `card-${Date.now()}`,
        createdAt: now,
      };
      const updatedList = [...cards, newCard];
      setCards(updatedList);
      saveCards(updatedList);
      syncSaveCard(newCard);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    const updated = cards.filter((c) => c.id !== cardId);
    setCards(updated);
    saveCards(updated);
    syncDeleteCard(cardId);
  };

  // Mark Settlement Completed
  const handleMarkSettledConfirm = () => {
    if (!pendingSettlementTx) return;
    const now = new Date().toISOString();
    const newSettlement: Settlement = {
      id: `st-${Date.now()}`,
      fromUserId: pendingSettlementTx.fromUser.id,
      toUserId: pendingSettlementTx.toUser.id,
      amountCents: pendingSettlementTx.amountCents,
      status: 'completed',
      createdAt: now,
      settledAt: now,
    };

    const updated = [newSettlement, ...settlements];
    setSettlements(updated);
    saveSettlements(updated);
    syncSaveSettlement(newSettlement);
    setPendingSettlementTx(null);
  };

  // Reset to Seed Data
  const handleResetDataConfirm = () => {
    const { expenses: seedExp, settlements: seedSt, cards: seedCards } = resetToSeedData();
    setExpenses(seedExp);
    setSettlements(seedSt);
    setCards(seedCards);
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddExpense={() => {
          setEditingExpense(null);
          setIsAddExpenseOpen(true);
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        theme={theme}
        toggleTheme={toggleTheme}
        expenseCount={householdExpenses.length}
        settlementCount={pendingSettlementsCount}
        personalCount={personalExpenses.length}
        cardsCount={userCards.length}
      />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            expenses={householdExpenses}
            settlements={settlements}
            onOpenAddExpense={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            onNavigateToSettlement={() => setActiveTab('settlement')}
            onNavigateToExpenses={() => setActiveTab('expenses')}
            onResetData={() => setIsResetConfirmOpen(true)}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpenseList
            expenses={householdExpenses}
            cards={cards}
            onOpenAddExpense={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            onEditExpense={(exp) => {
              setEditingExpense(exp);
              setIsAddExpenseOpen(true);
            }}
            onDeleteExpense={(id) => setDeletingExpenseId(id)}
          />
        )}

        {activeTab === 'settlement' && (
          <SettlementView
            expenses={householdExpenses}
            settlements={settlements}
            onMarkSettled={(tx) => setPendingSettlementTx(tx)}
          />
        )}

        <Suspense
          fallback={
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)', fontWeight: 700 }}>
              Loading Module...
            </div>
          }
        >
          {activeTab === 'personal' && (
            <PersonalWallet
              expenses={expenses}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={(id) => setDeletingExpenseId(id)}
            />
          )}

          {activeTab === 'cards' && (
            <CardsManager
              cards={cards}
              expenses={expenses}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlySummary expenses={householdExpenses} settlements={settlements} />
          )}
        </Suspense>
      </main>

      {/* Add / Edit Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        onSaveExpense={handleSaveExpense}
        initialExpense={editingExpense}
        cards={cards}
      />

      {/* Auth & Switch Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingExpenseId}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteExpenseConfirm}
        onClose={() => setDeletingExpenseId(null)}
      />

      {/* Reset Data Confirm Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset Demo Data"
        message="This will reset all household expenses, settlements, and cards to default sample scenarios. Proceed?"
        confirmText="Reset All Data"
        variant="danger"
        onConfirm={handleResetDataConfirm}
        onClose={() => setIsResetConfirmOpen(false)}
      />

      {/* Mark Settled Confirm Modal */}
      <ConfirmModal
        isOpen={!!pendingSettlementTx}
        title="Mark Settlement as Paid"
        message={
          pendingSettlementTx
            ? `Confirm that ${pendingSettlementTx.fromUser.name} paid ${pendingSettlementTx.toUser.name} $${(
                pendingSettlementTx.amountCents / 100
              ).toFixed(2)}? This will update current net balances.`
            : ''
        }
        confirmText="Confirm Payment"
        onConfirm={handleMarkSettledConfirm}
        onClose={() => setPendingSettlementTx(null)}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
