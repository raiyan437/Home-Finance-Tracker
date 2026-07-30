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
  clearAllFinancialData,
} from './utils/storage';
import { resetMockDBToDefault } from './utils/mockAuthDatabase';
import {
  subscribeExpenses,
  subscribeSettlements,
  subscribeCards,
  syncSaveExpense,
  syncDeleteExpense,
  syncSaveSettlement,
  syncDeleteSettlement,
  syncSaveCard,
  syncDeleteCard,
} from './utils/firebaseSync';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from './utils/settlementEngine';

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
  const { activeUserId, currentHouse, isAuthenticated, dbUserProfile } = useAuth();

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

  // Automated Recurring Expense Generator Engine
  useEffect(() => {
    if (expenses.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const newGeneratedExpenses: Expense[] = [];

    expenses.forEach((exp) => {
      if (!exp.isRecurring) return;
      const lastGen = exp.lastGeneratedDate || exp.date;
      const freq = exp.recurringFrequency || 'monthly';

      const lastDateObj = new Date(lastGen);
      if (isNaN(lastDateObj.getTime())) return;

      const nextDateObj = new Date(lastDateObj);
      if (freq === 'weekly') {
        nextDateObj.setDate(nextDateObj.getDate() + 7);
      } else {
        nextDateObj.setMonth(nextDateObj.getMonth() + 1);
      }

      const nextDateStr = nextDateObj.toISOString().split('T')[0];
      if (nextDateStr <= todayStr && lastGen !== todayStr) {
        const now = new Date().toISOString();
        const cloned: Expense = {
          ...exp,
          id: `exp-recur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: nextDateStr,
          lastGeneratedDate: nextDateStr,
          createdAt: now,
          updatedAt: now,
        };
        exp.lastGeneratedDate = nextDateStr;
        newGeneratedExpenses.push(cloned);
      }
    });

    if (newGeneratedExpenses.length > 0) {
      const updated = [...newGeneratedExpenses, ...expenses];
      setExpenses(updated);
      saveExpenses(updated);
      newGeneratedExpenses.forEach((e) => syncSaveExpense(e, currentHouse?.id));
    }
  }, [expenses.length]);

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
    return expenses.filter((e) => {
      const isHousehold = !e.scope || e.scope === 'household';
      if (!isHousehold) return false;

      if (currentHouse) {
        return e.houseId === currentHouse.id || !e.houseId;
      }

      // If user is not in any house, only show expenses created by or involving this user
      return (
        e.paidBy === activeUserId ||
        (e.shares && e.shares.some((s) => s.userId === activeUserId))
      );
    });
  }, [expenses, currentHouse, activeUserId]);

  const houseSettlements = useMemo(() => {
    return settlements.filter((s) => {
      if (currentHouse) {
        return (s as any).houseId === currentHouse.id || !(s as any).houseId;
      }
      return s.fromUserId === activeUserId || s.toUserId === activeUserId;
    });
  }, [settlements, currentHouse, activeUserId]);

  const personalExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope === 'personal' && (e.ownerId === activeUserId || e.paidBy === activeUserId));
  }, [expenses, activeUserId]);

  const userCards = useMemo(() => {
    return cards.filter((c) => !c.ownerId || c.ownerId === activeUserId);
  }, [cards, activeUserId]);

  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  // Derived financial computations
  const netBalances = useMemo(
    () => calculateNetBalances(householdExpenses, houseSettlements, houseUsers),
    [householdExpenses, houseSettlements, houseUsers]
  );

  const simplifiedSettlements = useMemo(
    () => calculateSimplifiedSettlements(netBalances, houseUsers),
    [netBalances, houseUsers]
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

  // Delete Comment Handler
  const handleDeleteComment = (expenseId: string, commentId: string) => {
    const now = new Date().toISOString();
    let updatedExp: Expense | undefined;
    const updated = expenses.map((e) => {
      if (e.id === expenseId && e.comments) {
        updatedExp = {
          ...e,
          comments: e.comments.filter((c) => c.id !== commentId),
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

  // Delete Card Handler with expense cascade handling
  const handleDeleteCard = (cardId: string) => {
    const updatedCards = cards.filter((c) => c.id !== cardId);
    setCards(updatedCards);
    saveCards(updatedCards);
    syncDeleteCard(cardId);

    // Scrub or switch linked expenses to cash
    const updatedExpenses = expenses.map((e) => {
      if (e.paymentMethod?.type === 'card' && e.paymentMethod.cardId === cardId) {
        const updatedExp = {
          ...e,
          paymentMethod: { type: 'cash' as const },
          updatedAt: new Date().toISOString(),
        };
        syncSaveExpense(updatedExp, currentHouse?.id);
        return updatedExp;
      }
      return e;
    });

    setExpenses(updatedExpenses);
    saveExpenses(updatedExpenses);
  };

  // Mark Settlement as Paid handler
  const handleMarkSettledConfirm = (proofUrl?: string) => {
    if (!pendingSettlementTx) return;

    const now = new Date().toISOString();
    const newSettlement: Settlement = {
      id: `set-${Date.now()}`,
      fromUserId: pendingSettlementTx.fromUser.id,
      toUserId: pendingSettlementTx.toUser.id,
      amountCents: pendingSettlementTx.amountCents,
      status: 'completed',
      proofUrl,
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

  // Reverse Settlement Handler
  const handleReverseSettlement = (settlementId: string) => {
    let targetSt: Settlement | undefined;
    const now = new Date().toISOString();
    const updated = settlements.map((st) => {
      if (st.id === settlementId) {
        targetSt = {
          ...st,
          status: 'reversed' as const,
          reversedAt: now,
          reversedBy: activeUserId,
        };
        return targetSt;
      }
      return st;
    });

    setSettlements(updated);
    saveSettlements(updated);
    if (targetSt) {
      syncSaveSettlement(targetSt, currentHouse?.id);
    }
  };

  // Clear All Settlements & Audit Log Handler
  const handleClearSettlements = () => {
    settlements.forEach((s) => syncDeleteSettlement(s.id));
    setSettlements([]);
    saveSettlements([]);
  };

  // Reset Demo Data handler with Cloud Firestore clearing & re-seeding
  const handleResetDataConfirm = () => {
    expenses.forEach((e) => syncDeleteExpense(e.id));
    settlements.forEach((s) => syncDeleteSettlement(s.id));
    cards.forEach((c) => syncDeleteCard(c.id));

    clearAllFinancialData();
    resetMockDBToDefault();

    setExpenses([]);
    setSettlements([]);
    setCards([]);

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
              settlements={houseSettlements}
              onNavigateToExpenses={() => setActiveTab('expenses')}
              onNavigateToSettlement={() => setActiveTab('settlement')}
              lang={lang}
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
              onDeleteComment={handleDeleteComment}
              lang={lang}
            />
          )}

          {activeTab === 'settlement' && (
            <SettlementView
              expenses={householdExpenses}
              settlements={houseSettlements}
              onMarkSettled={(tx: SimplifiedTransaction) => setPendingSettlementTx(tx)}
              onReverseSettlement={handleReverseSettlement}
              onClearSettlements={handleClearSettlements}
              lang={lang}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalWallet
              expenses={expenses}
              cards={cards}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={(id) => setDeletingExpenseId(id)}
              lang={lang}
            />
          )}

          {activeTab === 'cards' && (
            <CardsManager
              cards={cards}
              expenses={expenses}
              onAddCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
              lang={lang}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlySummary expenses={householdExpenses} settlements={houseSettlements} lang={lang} />
          )}

          {activeTab === 'settings' && <SettingsView lang={lang} />}
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
        lang={lang}
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
        onConfirm={() => handleMarkSettledConfirm()}
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
