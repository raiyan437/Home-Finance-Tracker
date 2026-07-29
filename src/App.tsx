import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ExpenseList } from './components/ExpenseList';
import { SettlementView } from './components/SettlementView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './components/LoginPage';
import { SignUpPage } from './components/SignUpPage';

import type { Expense, Settlement, SimplifiedTransaction, PaymentCard } from './types';
import type { Language } from './utils/i18n';
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
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const AppContent: React.FC = () => {
  const { activeUserId, currentHouse, isAuthenticated } = useAuth();

  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('en');

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
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

    const houseId = currentHouse?.id;

    // Subscribe to Firestore Realtime Updates when available
    const unsubExp = subscribeExpenses((fbExpenses) => {
      setExpenses(fbExpenses);
      saveExpenses(fbExpenses);
    }, houseId);

    const unsubSt = subscribeSettlements((fbSettlements) => {
      setSettlements(fbSettlements);
      saveSettlements(fbSettlements);
    }, houseId);

    const unsubCards = subscribeCards((fbCards) => {
      setCards(fbCards);
      saveCards(fbCards);
    }, houseId);

    return () => {
      unsubExp();
      unsubSt();
      unsubCards();
    };
  }, [currentHouse?.id]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('home_finance_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const toggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  // Filter household expenses (shared scope) vs personal expenses (private scope)
  const householdExpenses = useMemo(() => {
    return expenses.filter((e) => !e.scope || e.scope === 'household');
  }, [expenses]);

  const personalExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope === 'personal' && (e.ownerId === activeUserId || e.paidBy === activeUserId));
  }, [expenses, activeUserId]);

  const userCards = useMemo(() => {
    return cards.filter((c) => !c.ownerId || c.ownerId === activeUserId);
  }, [cards, activeUserId]);

  // Derived financial computations
  const netBalances = useMemo(
    () => calculateNetBalances(householdExpenses, settlements),
    [householdExpenses, settlements]
  );

  const simplifiedSettlements = useMemo(
    () => calculateSimplifiedSettlements(netBalances),
    [netBalances]
  );

  // Add / Edit expense handler
  const handleSaveExpense = (
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    const now = new Date().toISOString();
    let updatedExpenses: Expense[];
    let targetExpense: Expense = {
      ...expenseData,
      id: editingId || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      houseId: currentHouse?.id,
      createdAt: now,
      updatedAt: now,
    };

    if (editingId) {
      updatedExpenses = expenses.map((e) => {
        if (e.id === editingId) {
          return targetExpense;
        }
        return e;
      });
    } else {
      updatedExpenses = [targetExpense, ...expenses];
    }

    setExpenses(updatedExpenses);
    saveExpenses(updatedExpenses);
    syncSaveExpense(targetExpense, currentHouse?.id);
  };

  // Delete expense handler
  const handleConfirmDeleteExpense = () => {
    if (!deletingExpenseId) return;
    const updated = expenses.filter((e) => e.id !== deletingExpenseId);
    setExpenses(updated);
    saveExpenses(updated);
    syncDeleteExpense(deletingExpenseId);
    setDeletingExpenseId(null);
  };

  // Add Comment Handler
  const handleAddComment = (expenseId: string, text: string) => {
    const now = new Date().toISOString();
    const newComment = {
      id: `comment-${Date.now()}`,
      userId: activeUserId,
      text: text.trim(),
      createdAt: now,
    };

    let updatedExp: Expense | undefined;
    const updated = expenses.map((e) => {
      if (e.id === expenseId) {
        updatedExp = {
          ...e,
          comments: [...(e.comments || []), newComment],
          updatedAt: now,
        };
        return updatedExp;
      }
      return e;
    });

    setExpenses(updated);
    saveExpenses(updated);
    if (updatedExp) {
      syncSaveExpense(updatedExp, currentHouse?.id);
    }
  };

  // Save Card Handler
  const handleSaveCard = (cardData: Omit<PaymentCard, 'id' | 'createdAt'>, editingId?: string) => {
    const now = new Date().toISOString();
    let targetCard: PaymentCard = {
      ...cardData,
      id: editingId || `card-${Date.now()}`,
      houseId: currentHouse?.id,
      createdAt: now,
    };

    let updatedCards: PaymentCard[];
    if (editingId) {
      updatedCards = cards.map((c) => {
        if (c.id === editingId) {
          return targetCard;
        }
        return c;
      });
    } else {
      updatedCards = [targetCard, ...cards];
    }

    setCards(updatedCards);
    saveCards(updatedCards);
    syncSaveCard(targetCard, currentHouse?.id);
  };

  // Delete Card Handler
  const handleDeleteCard = (cardId: string) => {
    const updated = cards.filter((c) => c.id !== cardId);
    setCards(updated);
    saveCards(updated);
    syncDeleteCard(cardId);
  };

  // Mark Settlement as Paid handler
  const handleMarkSettledConfirm = () => {
    if (!pendingSettlementTx) return;

    const now = new Date().toISOString();
    const newSettlement: Settlement = {
      id: `set-${Date.now()}`,
      fromUserId: pendingSettlementTx.fromUser.id,
      toUserId: pendingSettlementTx.toUser.id,
      amountCents: pendingSettlementTx.amountCents,
      status: 'completed',
      houseId: currentHouse?.id,
      createdAt: now,
      settledAt: now,
      notes: `Direct settlement between ${pendingSettlementTx.fromUser.name} and ${pendingSettlementTx.toUser.name}`,
    };

    const updatedSettlements = [newSettlement, ...settlements];
    setSettlements(updatedSettlements);
    saveSettlements(updatedSettlements);
    syncSaveSettlement(newSettlement, currentHouse?.id);
    setPendingSettlementTx(null);
  };

  // Reset Demo Data handler
  const handleResetDataConfirm = () => {
    const seed = resetToSeedData();
    setExpenses(seed.expenses);
    setSettlements(seed.settlements);
    setIsResetConfirmOpen(false);
  };

  // Standalone Authentication Flow (Renders full LoginPage or SignUpPage when logged out)
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <SignUpPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToSignUp={() => setAuthView('signup')} />;
  }

  return (
    <div className="app-container">
      {/* Navigation Sidebar / Mobile Nav */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddExpense={() => {
          setEditingExpense(null);
          setIsAddExpenseOpen(true);
        }}
        theme={theme}
        toggleTheme={toggleTheme}
        lang={lang}
        toggleLang={toggleLang}
        expenseCount={householdExpenses.length}
        settlementCount={simplifiedSettlements.length}
        personalCount={personalExpenses.length}
        cardsCount={userCards.length}
      />

      {/* Main Content Viewport */}
      <main className="main-content">
        <Suspense
          fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--accent-primary)' }}>
              Loading view...
            </div>
          }
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              expenses={householdExpenses}
              settlements={settlements}
              onNavigateToExpenses={() => setActiveTab('expenses')}
              onNavigateToSettlement={() => setActiveTab('settlement')}
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
              onAddComment={handleAddComment}
            />
          )}

          {activeTab === 'settlement' && (
            <SettlementView
              expenses={householdExpenses}
              settlements={settlements}
              onMarkSettled={(tx: SimplifiedTransaction) => setPendingSettlementTx(tx)}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalWallet
              expenses={expenses}
              cards={cards}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={(id) => setDeletingExpenseId(id)}
            />
          )}

          {activeTab === 'cards' && (
            <CardsManager
              cards={cards}
              expenses={expenses}
              onAddCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlySummary expenses={householdExpenses} settlements={settlements} />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </Suspense>
      </main>

      {/* Modals & Overlays */}
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

      {/* Delete Expense Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingExpenseId}
        title="Delete Expense Record"
        message="Are you sure you want to delete this expense? This will permanently recalculate housemate net balances."
        confirmText="Delete Expense"
        variant="danger"
        onConfirm={handleConfirmDeleteExpense}
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
            ? `Confirm that ${pendingSettlementTx.fromUser.name} paid ${pendingSettlementTx.toUser.name} ৳${(
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
  <ErrorBoundary>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
