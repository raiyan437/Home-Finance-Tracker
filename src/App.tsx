import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ExpenseList } from './components/ExpenseList';
import { SettlementView } from './components/SettlementView';
import { MonthlySummary } from './components/MonthlySummary';
import { PersonalWallet } from './components/PersonalWallet';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AuthModal } from './components/AuthModal';
import { ConfirmModal } from './components/ConfirmModal';

import type { Expense, Settlement, SimplifiedTransaction } from './types';
import {
  loadExpenses,
  saveExpenses,
  loadSettlements,
  saveSettlements,
  resetToSeedData,
} from './utils/storage';
import { calculateNetBalances, calculateSimplifiedSettlements } from './utils/settlementEngine';

const AppContent: React.FC = () => {
  const { activeUserId } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [pendingSettlementTx, setPendingSettlementTx] = useState<SimplifiedTransaction | null>(null);

  // Initialize data and theme
  useEffect(() => {
    setExpenses(loadExpenses());
    setSettlements(loadSettlements());

    const savedTheme = (localStorage.getItem('home_finance_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
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
      const updated = expenses.map((e) =>
        e.id === editingId
          ? {
              ...e,
              ...expenseData,
              updatedAt: now,
            }
          : e
      );
      setExpenses(updated);
      saveExpenses(updated);
    } else {
      const newExpense: Expense = {
        ...expenseData,
        id: `exp-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [newExpense, ...expenses];
      setExpenses(updated);
      saveExpenses(updated);
    }
  };

  // Delete Expense handler
  const handleDeleteExpenseConfirm = () => {
    if (!deletingExpenseId) return;
    const updated = expenses.filter((e) => e.id !== deletingExpenseId);
    setExpenses(updated);
    saveExpenses(updated);
    setDeletingExpenseId(null);
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
    setPendingSettlementTx(null);
  };

  // Reset to Seed Data
  const handleResetDataConfirm = () => {
    const { expenses: seedExp, settlements: seedSt } = resetToSeedData();
    setExpenses(seedExp);
    setSettlements(seedSt);
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

        {activeTab === 'personal' && (
          <PersonalWallet
            expenses={expenses}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={(id) => setDeletingExpenseId(id)}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlySummary expenses={householdExpenses} settlements={settlements} />
        )}
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
        message="This will reset all household expenses and settlements to default sample scenarios. Proceed?"
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
