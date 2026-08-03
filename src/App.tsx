import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
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
  houseStorageScope,
  personalStorageScope,
} from './services/storage';
import {
  subscribeExpenses,
  subscribePersonalExpenses,
  subscribeSettlements,
  subscribeCards,
  syncSaveExpense,
  syncDeleteExpense,
  syncDeleteHouseExpense,
  syncSaveSettlement,
  syncDeleteSettlement,
  syncDeleteHouseSettlement,
  flushSyncOutbox,
  syncSaveCard,
  syncDeleteCard,
  syncAddExpenseComment,
  syncDeleteExpenseComment,
} from './services/firebaseSync';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from './features/settlementEngine';
import { generateDueRecurringExpenses, localDateKey } from './features/recurringEngine';
import { createId } from './utils/ids';
import { assertValidExpense, assertValidSettlement } from './features/ledgerValidation';

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

const getBasePath = (): string => {
  if (typeof window === 'undefined') return '';
  if (window.location.hostname.endsWith('github.io')) {
    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
    return firstSegment ? `/${firstSegment}` : '';
  }
  return '';
};

const getPathForTab = (tab: TabType): string => {
  const basePath = getBasePath();
  return tab === 'dashboard' ? `${basePath}/` : `${basePath}/${tab}`;
};

const getTabFromPath = (): TabType | 'notfound' => {
  // Backward compatibility: If user visits an old hash link (e.g. /#/expenses), clean it to /expenses
  if (typeof window !== 'undefined' && window.location.hash) {
    const rawHash = window.location.hash.replace('#', '').replace('/', '').trim().toLowerCase() as TabType;
    if (VALID_TABS.includes(rawHash)) {
      const cleanPath = getPathForTab(rawHash);
      window.history.replaceState({}, '', cleanPath);
      return rawHash;
    }
  }

  if (typeof window === 'undefined') return 'dashboard';

  const basePath = getBasePath();
  const pathname = window.location.pathname
    .slice(basePath.length)
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
  if (!pathname || pathname === 'dashboard' || pathname === 'index.html') {
    return 'dashboard';
  }
  if (VALID_TABS.includes(pathname as TabType)) {
    return pathname as TabType;
  }
  return 'notfound';
};

const AppContent: React.FC = () => {
  const { activeUserId, currentHouse, isAuthenticated, dbUserProfile, loading } = useAuth();
  const currentUserId = dbUserProfile?.uid || activeUserId;
  const currentHouseScope = currentHouse?.id ? houseStorageScope(currentHouse.id) : undefined;
  const currentPersonalScope = personalStorageScope(currentUserId);

  const persistExpenses = useCallback((allExpenses: Expense[]) => {
    if (currentHouseScope && currentHouse?.id) {
      saveExpenses(
        allExpenses.filter((expense) => expense.scope !== 'personal' && expense.houseId === currentHouse.id),
        currentHouseScope
      );
    }
    saveExpenses(
      allExpenses.filter(
        (expense) => expense.scope === 'personal' && expense.ownerId === currentUserId
      ),
      currentPersonalScope
    );
  }, [currentHouse?.id, currentHouseScope, currentPersonalScope, currentUserId]);

  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTabState] = useState<TabType | 'notfound'>(getTabFromPath);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [lang, setLang] = useState<Language>(() => (
    localStorage.getItem('home_finance_language') === 'bn' ? 'bn' : 'en'
  ));

  useEffect(() => {
    const retryPendingWrites = () => { void flushSyncOutbox(); };
    window.addEventListener('online', retryPendingWrites);
    retryPendingWrites();
    return () => window.removeEventListener('online', retryPendingWrites);
  }, []);

  const handleTabChange = (nextTab: TabType) => {
    setActiveTabState(nextTab);
    const targetPath = getPathForTab(nextTab);
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

  // Initialize data, theme, accent, and Firestore realtime subscriptions
  useEffect(() => {
    let cachedHouseExpenses = currentHouseScope ? loadExpenses(currentHouseScope) : [];
    let cachedPersonalExpenses = loadExpenses(currentPersonalScope);
    let cachedSettlements = currentHouseScope ? loadSettlements(currentHouseScope) : [];
    const cachedCards = loadCards(currentPersonalScope);

    // One-time migration for records created before houseId/ownerId scoping was introduced.
    const migrationKey = `home_finance_scope_migrated_v4_${currentHouse?.id || 'no-house'}_${currentUserId}`;
    if (localStorage.getItem(migrationKey) !== 'true') {
      const migrationWrites: Promise<unknown>[] = [];
      const legacyExpenses = loadExpenses();
      const legacySettlements = loadSettlements();
      const memberIdentitySet = new Set(
        (currentHouse?.members || []).map((member) => member.uid.toLowerCase())
      );
      const identityBelongsToHouse = (identity: string) => memberIdentitySet.has(identity.toLowerCase().trim());

      if (currentHouse?.id) {
        const migratedHouseExpenses = legacyExpenses
          .filter(
            (expense) =>
              expense.scope !== 'personal' &&
              !expense.houseId &&
              identityBelongsToHouse(expense.paidBy) &&
              expense.shares.every((share) => identityBelongsToHouse(share.userId))
          )
          .map((expense) => ({ ...expense, scope: 'household' as const, houseId: currentHouse.id }));
        const migratedSettlements = legacySettlements
          .filter(
            (settlement) =>
              !settlement.houseId &&
              identityBelongsToHouse(settlement.fromUserId) &&
              identityBelongsToHouse(settlement.toUserId)
          )
          .map((settlement) => ({ ...settlement, houseId: currentHouse.id }));
        cachedHouseExpenses = [...migratedHouseExpenses, ...cachedHouseExpenses];
        cachedSettlements = [...migratedSettlements, ...cachedSettlements];
        migratedHouseExpenses.forEach((expense) => migrationWrites.push(syncSaveExpense(expense, currentHouse.id)));
        migratedSettlements.forEach((settlement) => migrationWrites.push(syncSaveSettlement(settlement, currentHouse.id)));
      }

      const migratedPersonalExpenses = legacyExpenses
        .filter(
          (expense) =>
            expense.scope === 'personal' &&
            (expense.ownerId === currentUserId || expense.paidBy === currentUserId)
        )
        .map((expense) => ({
          ...expense,
          id: expense.ownerId === currentUserId ? expense.id : `migrated-${currentUserId}-${expense.id}`,
          ownerId: currentUserId,
          paidBy: currentUserId,
          houseId: undefined,
        }));
      cachedPersonalExpenses = [...migratedPersonalExpenses, ...cachedPersonalExpenses];
      migratedPersonalExpenses.forEach((expense) => migrationWrites.push(syncSaveExpense(expense)));
      void Promise.all(migrationWrites).then((results) => {
        if (results.every((result) => !result || (result as { queued?: boolean }).queued !== true)) {
          localStorage.setItem(migrationKey, 'true');
        }
      });
    }

    const publishExpenses = () => {
      const deduplicated = new Map<string, Expense>();
      [...cachedHouseExpenses, ...cachedPersonalExpenses].forEach((expense) => deduplicated.set(expense.id, expense));
      const combined = Array.from(deduplicated.values());
      setExpenses(combined);
      persistExpenses(combined);
    };

    publishExpenses();
    setSettlements(cachedSettlements);
    setCards(cachedCards);

    const savedTheme = (localStorage.getItem('home_finance_theme') as 'dark' | 'light') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const houseId = currentHouse?.id;

    // Subscribe to Firestore Realtime Updates when available
    const unsubExp = subscribeExpenses((fbExpenses) => {
      cachedHouseExpenses = fbExpenses.filter((expense) => expense.scope !== 'personal');
      publishExpenses();
    }, houseId);

    const unsubPersonalExp = subscribePersonalExpenses((fbExpenses) => {
      cachedPersonalExpenses = fbExpenses;
      publishExpenses();
    }, currentUserId);

    const unsubSt = subscribeSettlements((fbSettlements) => {
      setSettlements(fbSettlements);
      cachedSettlements = fbSettlements;
      if (currentHouseScope) saveSettlements(fbSettlements, currentHouseScope);
    }, houseId);

    const cardOwnerId = dbUserProfile?.uid || activeUserId;
    const unsubCards = subscribeCards(
      (fbCards) => {
        setCards(fbCards);
        saveCards(fbCards, currentPersonalScope);
      },
      null,
      cardOwnerId
    );

    return () => {
      unsubExp();
      unsubPersonalExp();
      unsubSt();
      unsubCards();
    };
  }, [currentHouse?.id, currentHouse?.members, currentHouseScope, currentPersonalScope, currentUserId, activeUserId, dbUserProfile?.uid, persistExpenses]);

  // Generate every due occurrence exactly once using deterministic IDs.
  useEffect(() => {
    if (expenses.length === 0) return;
    const result = generateDueRecurringExpenses(
      expenses,
      localDateKey(),
      new Date().toISOString(),
      (template) =>
        template.scope === 'personal' ||
        template.paidBy === currentUserId ||
        dbUserProfile?.role === 'leader'
    );
    if (result.generated.length > 0 || result.updatedTemplates.length > 0) {
      setExpenses(result.expenses);
      persistExpenses(result.expenses);
      [...result.generated, ...result.updatedTemplates].forEach((expense) =>
        syncSaveExpense(expense, expense.scope === 'personal' ? undefined : expense.houseId || currentHouse?.id)
      );
    }
  }, [expenses, currentHouse?.id, currentUserId, dbUserProfile?.role, persistExpenses]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('home_finance_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'bn' : 'en';
      localStorage.setItem('home_finance_language', next);
      return next;
    });
  };

  // Filter household expenses (shared scope) vs personal expenses (private scope)
  const householdExpenses = useMemo(() => {
    if (!currentHouse?.id) return [];

    return expenses.filter((e) => {
      const isHousehold = !e.scope || e.scope === 'household';
      if (!isHousehold) return false;

      return e.houseId === currentHouse.id;
    });
  }, [expenses, currentHouse]);

  const houseSettlements = useMemo(() => {
    if (!currentHouse?.id) return [];
    return settlements.filter((settlement) => settlement.houseId === currentHouse.id);
  }, [settlements, currentHouse]);

  const personalExpenses = useMemo(() => {
    return expenses.filter((e) => e.scope === 'personal' && e.ownerId === currentUserId);
  }, [expenses, currentUserId]);

  const userCards = useMemo(() => {
    return cards.filter((card) => card.ownerId === currentUserId);
  }, [cards, currentUserId]);

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
      sharesTotalCents: expenseData.shares.reduce((sum, share) => sum + share.amountCents, 0),
      participantUids: expenseData.shares.map((share) => share.userId),
      id: editingId || createId('exp'),
      houseId: isPersonal ? undefined : currentHouse?.id,
      createdAt: existingExpense?.createdAt || now,
      updatedAt: now,
    };
    assertValidExpense(targetExpense, isPersonal ? null : currentHouse);

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
    persistExpenses(updatedExpenses);
    syncSaveExpense(targetExpense, isPersonal ? undefined : currentHouse?.id);
    notifyNewExpense(targetExpense.title, formatCurrency(targetExpense.amountCents), dbUserProfile?.displayName || activeUserId);
  };

  // Delete expense handler
  const handleConfirmDeleteExpense = () => {
    if (!deletingExpenseId) return;
    const updated = expenses.filter((e) => e.id !== deletingExpenseId);
    setExpenses(updated);
    persistExpenses(updated);
    const deletingExpense = expenses.find((expense) => expense.id === deletingExpenseId);
    if (deletingExpense?.scope === 'personal' || !currentHouse?.id) syncDeleteExpense(deletingExpenseId);
    else syncDeleteHouseExpense(deletingExpenseId, currentHouse.id);
    setDeletingExpenseId(null);
  };

  // Add Comment Handler
  const handleAddComment = (expenseId: string, text: string) => {
    const now = new Date().toISOString();
    const commentAuthorId = dbUserProfile?.uid || activeUserId;
    const newComment = {
      id: createId('comment'),
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
    persistExpenses(updated);
    if (updatedExp) {
      syncAddExpenseComment(updatedExp, newComment);
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
    persistExpenses(updated);
    if (updatedExp) {
      syncDeleteExpenseComment(updatedExp, commentId);
    }
  };

  // Save Card Handler
  const handleSaveCard = (cardData: Omit<PaymentCard, 'id' | 'createdAt'>, editingId?: string) => {
    const now = new Date().toISOString();
    let targetCard: PaymentCard = {
      ...cardData,
      id: editingId || createId('card'),
      houseId: undefined,
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
    saveCards(updatedCards, currentPersonalScope);
    syncSaveCard(targetCard);
  };

  // Deleting a card must not rewrite historical payment records.
  const handleDeleteCard = (cardId: string) => {
    const updatedCards = cards.filter((c) => c.id !== cardId);
    setCards(updatedCards);
    saveCards(updatedCards, currentPersonalScope);
    syncDeleteCard(cardId);

  };

  // Mark Settlement as Paid handler
  const handleMarkSettledConfirm = (transaction: SimplifiedTransaction, proofUrl?: string) => {
    const now = new Date().toISOString();
    const newSettlement: Settlement = {
      id: createId('set'),
      fromUserId: transaction.fromUser.id,
      toUserId: transaction.toUser.id,
      amountCents: transaction.amountCents,
      status: 'completed',
      proofUrl,
      houseId: currentHouse?.id,
      createdAt: now,
      settledAt: now,
      notes: `Direct settlement between ${transaction.fromUser.name} and ${transaction.toUser.name}`,
    };

    if (!currentHouse) return;
    assertValidSettlement(newSettlement, currentHouse);
    const updatedSettlements = [newSettlement, ...settlements];
    setSettlements(updatedSettlements);
    if (currentHouseScope) saveSettlements(updatedSettlements, currentHouseScope);
    syncSaveSettlement(newSettlement, currentHouse?.id);
    notifyPendingSettlement(transaction.fromUser.name, transaction.toUser.name, formatCurrency(transaction.amountCents));
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
          reversedBy: currentUserId,
        };
        return targetSt;
      }
      return st;
    });

    setSettlements(updated);
    if (currentHouseScope) saveSettlements(updated, currentHouseScope);
    if (targetSt) {
      syncSaveSettlement(targetSt, currentHouse?.id);
    }
  };

  // Clear All Settlements & Audit Log Handler
  const handleClearSettlements = () => {
    settlements.forEach((s) => currentHouse?.id ? syncDeleteHouseSettlement(s.id, currentHouse.id) : syncDeleteSettlement(s.id));
    setSettlements([]);
    if (currentHouseScope) saveSettlements([], currentHouseScope);
  };

  // Reset Data handler — clears financial data only, preserves user accounts and house membership
  if (loading) {
    return <LoadingSpinner message="Authenticating session..." fullScreen />;
  }

  // Standalone Authentication Flow (Renders full LoginPage or SignUpPage when logged out)
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <SignUpPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToSignUp={() => setAuthView('signup')} onLoginSuccess={() => handleTabChange('dashboard')} />;
  }

  return (
    <div className="app-container">
      <div className="ambient-background" aria-hidden="true">
        <span className="ambient-orb ambient-orb-one" />
        <span className="ambient-orb ambient-orb-two" />
        <span className="ambient-orb ambient-orb-three" />
      </div>
      {/* Navigation Sidebar / Mobile Nav */}
      <Navbar
        activeTab={activeTab === 'notfound' ? 'dashboard' : activeTab}
        setActiveTab={handleTabChange}
        theme={theme}
        toggleTheme={toggleTheme}
        lang={lang}
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
            className="glass-card onboarding-banner"
            style={{
              borderLeft: '4px solid var(--accent-primary)',
              marginBottom: '24px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
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

        <div className="page-transition" key={activeTab}>
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
              onMarkSettled={handleMarkSettledConfirm}
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

          {activeTab === 'settings' && <SettingsPage lang={lang} toggleLang={toggleLang} />}

          {!VALID_TABS.includes(activeTab as TabType) && (
            <NotFoundPage onGoHome={() => handleTabChange('dashboard')} lang={lang} />
          )}
        </Suspense>
        </div>
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
