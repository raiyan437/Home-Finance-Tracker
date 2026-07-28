import React, { useState, useMemo } from 'react';
import type { Expense, Category } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, dollarsToCents } from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { Wallet, Plus, TrendingUp, ShieldCheck, Trash2, Edit, X, PieChart } from 'lucide-react';

interface PersonalWalletProps {
  expenses: Expense[];
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORIES: Category[] = ['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

export const PersonalWallet: React.FC<PersonalWalletProps> = ({
  expenses,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const { userProfile, activeUserId } = useAuth();

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedMonth] = useState(currentMonthKey);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);

  // Form states for personal expense
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Filter personal expenses belonging strictly to the active user
  const personalExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.scope === 'personal' && e.ownerId === activeUserId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeUserId]);

  const monthPersonalExpenses = useMemo(() => {
    return personalExpenses.filter((e) => e.date.startsWith(selectedMonth));
  }, [personalExpenses, selectedMonth]);

  const totalPersonalSpentCents = monthPersonalExpenses.reduce((sum, e) => sum + e.amountCents, 0);

  // Default personal monthly budget target ($500.00)
  const [monthlyBudgetDollars, setMonthlyBudgetDollars] = useState('500.00');
  const monthlyBudgetCents = dollarsToCents(monthlyBudgetDollars);
  const budgetRatioPercent = monthlyBudgetCents > 0 ? Math.min(100, (totalPersonalSpentCents / monthlyBudgetCents) * 100) : 0;

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthPersonalExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amountCents;
    });
    return map;
  }, [monthPersonalExpenses]);

  const handleOpenAdd = (exp?: Expense) => {
    if (exp) {
      setEditingExp(exp);
      setTitle(exp.title);
      setAmountStr((exp.amountCents / 100).toFixed(2));
      setCategory(exp.category);
      setDate(exp.date);
      setNotes(exp.notes || '');
    } else {
      setEditingExp(null);
      setTitle('');
      setAmountStr('');
      setCategory('Personal');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = dollarsToCents(amountStr);
    if (!title.trim() || cents <= 0) return;

    onSaveExpense(
      {
        title: title.trim(),
        amountCents: cents,
        paidBy: activeUserId,
        category,
        date,
        splitMethod: 'equal',
        shares: [{ userId: activeUserId, amountCents: cents }],
        scope: 'personal',
        ownerId: activeUserId,
        notes: notes.trim(),
      },
      editingExp ? editingExp.id : undefined
    );

    setIsAddModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserAvatar user={userProfile} size={40} />
            <div>
              <h1 className="page-title">{userProfile.name}'s Personal Wallet</h1>
              <p className="page-description">
                Private money tracker — expenses logged here do not affect household debt settlements
              </p>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
          <Plus size={18} />
          <span>Add Personal Expense</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.12))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <ShieldCheck size={28} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Strict Personal Privacy Active</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            These records are stored exclusively under <strong>{userProfile.name}'s account</strong>. Other housemates cannot view or balance against your personal wallet.
          </p>
        </div>
      </div>

      {/* Stats & Budget Grid */}
      <div className="grid-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Monthly Personal Outlay</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <Wallet size={20} />
            </div>
          </div>
          <div className="summary-amount tabular-nums" style={{ color: 'var(--accent-purple)' }}>
            {formatCurrency(totalPersonalSpentCents)}
          </div>
          <div className="summary-footer">
            <span>{monthPersonalExpenses.length} personal purchases this month</span>
          </div>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Monthly Budget Target</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="tabular-nums" style={{ fontSize: '1.85rem', fontWeight: 800 }}>$</span>
            <input
              type="number"
              step="10"
              className="form-input tabular-nums"
              style={{ fontSize: '1.5rem', fontWeight: 800, padding: '4px 8px', width: '130px' }}
              value={monthlyBudgetDollars}
              onChange={(e) => setMonthlyBudgetDollars(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Budget Used</span>
              <span>{budgetRatioPercent.toFixed(0)}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${budgetRatioPercent}%`,
                  backgroundColor: budgetRatioPercent > 90 ? 'var(--accent-rose)' : 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Personal Spend Distribution</span>
        </h2>

        {Object.keys(categoryTotals).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
            No personal expenses recorded for this month.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(categoryTotals).map(([cat, amount]) => {
              const pct = totalPersonalSpentCents > 0 ? (amount / totalPersonalSpentCents) * 100 : 0;
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700 }}>
                    <span>{cat}</span>
                    <span className="tabular-nums">{formatCurrency(amount)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="chart-bar-track">
                    <div
                      className="chart-bar-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: 'var(--accent-purple)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Personal Expense Ledger */}
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>Personal Purchases</h2>

        {personalExpenses.length === 0 ? (
          <div className="glass-card empty-state">
            <Wallet className="empty-icon" />
            <div className="empty-title">Your Personal Wallet is Empty</div>
            <p style={{ fontSize: '0.85rem' }}>Log your private expenses here to manage personal budgets independently.</p>
            <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
              <Plus size={16} /> Add First Personal Expense
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {personalExpenses.map((exp) => (
              <div key={exp.id} className="expense-item-card">
                <div className="expense-left">
                  <UserAvatar user={userProfile} size={42} />
                  <div className="expense-info-group">
                    <div className="expense-title-row">
                      <span className="expense-title">{exp.title}</span>
                      <span className={`cat-pill cat-${exp.category}`}>{exp.category}</span>
                    </div>
                    <div className="expense-meta-row">
                      <span>{exp.date}</span>
                      {exp.notes && (
                        <>
                          <span>•</span>
                          <span>{exp.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="expense-right">
                  <div className="expense-amount-display tabular-nums" style={{ color: 'var(--accent-purple)' }}>
                    {formatCurrency(exp.amountCents)}
                  </div>
                  <div className="expense-actions-group">
                    <button className="btn btn-secondary btn-icon-only" onClick={() => handleOpenAdd(exp)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-danger btn-icon-only" onClick={() => onDeleteExpense(exp.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Personal Expense Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingExp ? 'Edit Personal Expense' : 'Log Personal Expense'}</h2>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Expense Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Personal Coffee, Shopping"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input tabular-nums"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Private details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingExp ? 'Save Changes' : 'Save Personal Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
