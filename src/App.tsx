import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ExpenseListPage } from './pages/ExpenseListPage';
import { SettlementPage } from './pages/SettlementPage';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';

import type { Expense, Settlement, SimplifiedTransaction, PaymentCard } from './types';
import type { Language } from './utils/i18n';
import { formatCurrency } from './utils/currency';
import { notifyNewExpense, notifyPendingSettlement } from './utils/notifications';
import {
  loadExpenses,
  saveExpenses,
  loadSettlements,
  saveSettlements,
  loadCards,
  saveCards,
  clearAllFinancialData,
} from './services/storage';
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
} from './services/firebaseSync';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from './features/settlementEngine';

// Code-split heavy views for instant page loads
const MonthlyPage = lazy(() =>
  import('./pages/MonthlyPage').then((m) => ({ default: m.MonthlyPage }))
);
const PersonalWalletPage = lazy(() =>
  import('./pages/PersonalWalletPage').then((m) => ({ default: m.PersonalWalletPage }))
);
const CardsPage = lazy(() =>
  import('./pages/CardsPage').then((m) => ({ default: m.CardsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const HousePage = lazy(() =>
  import('./pages/HousePage').then((m) => ({ default: m.HousePage }))
);

const VALID_TABS: TabType[] = ['dashboard', 'expenses', 'settlement', 'personal', 'cards', 'monthly', 'house', 'settings'];

const getTabFromPath = (): TabType | 'notfound' => {
  // Backward compatibility: If user visits an old hash link (e.g. /#/expenses), clean it to /expenses
  if (typeof window !== 'undefined' && window.location.hash) {
    const rawHash = window.location.hash.replace('#', '').replace('/', '').trim().toLowerCase() as TabType;
    if (VALID_TABS.includes(rawHash)) {
      const cleanPath = rawHash === 'dashboard' ? '/' : `/${rawHash}`;
      window.history.replaceState({}, '', cleanPath);
      return rawHash;
    }
  }

  if (typeof window === 'undefined') return 'dashboard';

  const pathname = window.location.pathname.replace(/^\/+/, '').trim().toLowerCase();
  if (!pathname || pathname === 'dashboard' || pathname === 'index.html') {
    return 'dashboard';
  }
  if (VALID_TABS.includes(pathname as TabType)) {
    return pathname as TabType;
  }
  return 'notfound';
};

const AppContent: React.FC = () => {
  const { activeUserId, currentHouse, isAuthenticated, dbUserProfile } = useAuth();

  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTabState] = useState<TabType | 'notfound'>(getTabFromPath);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('en');

  const handleTabChange = (nextTab: TabType) => {
    setActiveTabState(nextTab);
    const targetPath = nextTab === 'dashboard' ? '/' : `/${nextTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const currentTab = getTabFromPath();
      setActiveTabState(currentTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('home_finance_sidebar_collapsed') === 'true';
  });

  // Track viewport width to conditionally apply sidebar margin (desktop only)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('home_finance_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [pendingSettlementTx, setPendingSettlementTx] = useState<SimplifiedTransaction | null>(null);

  // Initialize data, theme, accent, and Firestore realtime subscriptions
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

    const cardOwnerId = dbUserProfile?.uid || activeUserId;
    const unsubCards = subscribeCards(
      (fbCards) => {
        setCards(fbCards);
        saveCards(fbCards);
      },
      houseId,
      cardOwnerId
    );

    return () => {
      unsubExp();
      unsubSt();
      unsubCards();
    };
  }, [currentHouse?.id, dbUserProfile?.uid, activeUserId]);

  // Automated Recurring Expense Generator Engine (runs once per session on mount)
  useEffect(() => {
    if (expenses.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const newGeneratedExpenses: Expense[] = [];
    const processedParentIds = new Set<string>();

    expenses.forEach((exp) => {
      if (!exp.isRecurring) return;
      if (processedParentIds.has(exp.id)) return;
      processedParentIds.add(exp.id);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!currentHouse?.id) return [];
    const myUid = dbUserProfile?.uid || activeUserId;
    const memberUids = currentHouse.members?.map((m) => m.uid) || [myUid];

    return expenses.filter((e) => {
      const isHousehold = !e.scope || e.scope === 'household';
      if (!isHousehold) return false;

      if (e.houseId === currentHouse.id) return true;
      const isMemberPayer = memberUids.includes(e.paidBy) || memberUids.some((uid) => e.paidBy?.toLowerCase() === uid.toLowerCase());
      const isMemberShare = e.shares && e.shares.some((s) => memberUids.includes(s.userId));
      return isMemberPayer || isMemberShare;
    });
  }, [expenses, currentHouse, activeUserId, dbUserProfile]);

  const houseSettlements = useMemo(() => {
    if (!currentHouse?.id) return [];
    const myUid = dbUserProfile?.uid || activeUserId;
    const memberUids = currentHouse.members?.map((m) => m.uid) || [myUid];

    return settlements.filter((s) => {
      if ((s as any).houseId === currentHouse.id) return true;
      return memberUids.includes(s.fromUserId) || memberUids.includes(s.toUserId);
    });
  }, [settlements, currentHouse, activeUserId, dbUserProfile]);

  const personalExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope === 'personal' && (e.ownerId === activeUserId || e.paidBy === activeUserId));
  }, [expenses, activeUserId]);

  const userCards = useMemo(() => {
    const myUid = dbUserProfile?.uid || activeUserId;
    return cards.filter(
      (c) => c.ownerId === myUid || c.ownerId === activeUserId || c.ownerId === dbUserProfile?.uid
    );
  }, [cards, activeUserId, dbUserProfile]);

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

    // Preserve original createdAt when editing; skip houseId for personal expenses
    const existingExpense = editingId ? expenses.find((e) => e.id === editingId) : null;
    const isPersonal = expenseData.scope === 'personal';

    let targetExpense: Expense = {
      ...expenseData,
      id: editingId || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      houseId: isPersonal ? undefined : currentHouse?.id,
      createdAt: existingExpense?.createdAt || now,
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
    syncSaveExpense(targetExpense, isPersonal ? undefined : currentHouse?.id);
    notifyNewExpense(targetExpense.title, formatCurrency(targetExpense.amountCents), dbUserProfile?.displayName || activeUserId);
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
    const commentAuthorId = dbUserProfile?.uid || activeUserId;
    const newComment = {
      id: `comment-${Date.now()}`,
      userId: commentAuthorId,
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
    notifyPendingSettlement(pendingSettlementTx.fromUser.name, pendingSettlementTx.toUser.name, formatCurrency(pendingSettlementTx.amountCents));
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

  // Reset Data handler — clears financial data only, preserves user accounts and house membership
  const handleResetDataConfirm = () => {
    expenses.forEach((e) => syncDeleteExpense(e.id));
    settlements.forEach((s) => syncDeleteSettlement(s.id));
    cards.forEach((c) => syncDeleteCard(c.id));

    clearAllFinancialData();

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
        setActiveTab={handleTabChange}
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
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Viewport — sidebar is desktop-only; on mobile no offset needed */}
      <main
        className="main-content"
        style={
          isDesktop
            ? {
                marginLeft: isSidebarCollapsed ? '76px' : '260px',
                width: `calc(100% - ${isSidebarCollapsed ? '76px' : '260px'})`,
                transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }
            : { marginLeft: 0, width: '100%' }
        }
      >
        {/* First-Time User House Onboarding Banner */}
        {!currentHouse && (
          <div
            className="glass-card"
            style={{
              borderLeft: '4px solid var(--accent-primary)',
              marginBottom: '24px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏠 Welcome! You are not in a Household yet</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Create a new household space to invite housemates or join an existing household using a join code.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => handleTabChange('house')}>
                <span>👑 Create a New House</span>
              </button>
              <button className="btn btn-secondary" onClick={() => handleTabChange('house')}>
                <span>👤 Join Existing House</span>
              </button>
            </div>
          </div>
        )}

        <Suspense fallback={<LoadingSpinner message="Loading application view..." />}>
          {activeTab === 'dashboard' && (
            <DashboardPage
              expenses={householdExpenses}
              settlements={houseSettlements}
              onNavigateToExpenses={() => handleTabChange('expenses')}
              onNavigateToSettlement={() => handleTabChange('settlement')}
              lang={lang}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseListPage
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
            <SettlementPage
              expenses={householdExpenses}
              settlements={houseSettlements}
              onMarkSettled={(tx: SimplifiedTransaction) => setPendingSettlementTx(tx)}
              onReverseSettlement={handleReverseSettlement}
              onClearSettlements={handleClearSettlements}
              lang={lang}
            />
          )}

          {activeTab === 'house' && <HousePage lang={lang} />}

          {activeTab === 'personal' && (
            <PersonalWalletPage
              expenses={expenses}
              cards={cards}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={(id) => setDeletingExpenseId(id)}
              lang={lang}
            />
          )}

          {activeTab === 'cards' && (
            <CardsPage
              cards={cards}
              expenses={expenses}
              onAddCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
              lang={lang}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlyPage expenses={householdExpenses} settlements={houseSettlements} lang={lang} />
          )}

          {activeTab === 'settings' && <SettingsPage lang={lang} />}

          {!VALID_TABS.includes(activeTab) && (
            <NotFoundPage onGoHome={() => handleTabChange('dashboard')} lang={lang} />
          )}
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
        cards={userCards}
        houseUsers={houseUsers}
        activeUserId={dbUserProfile?.uid || activeUserId}
        lang={lang}
        fixedScope="household"
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
