import React, { useState, useMemo } from 'react';
import type { Expense, Category, PaymentCard, PaymentMethodType } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, dollarsToCents } from '../utils/currency';
import { USERS } from '../utils/settlementEngine';
import { UserAvatar } from './UserAvatar';
import { Wallet, Plus, TrendingUp, ShieldCheck, Trash2, Edit, X, PieChart, CreditCard, Banknote, Calendar } from 'lucide-react';

interface PersonalWalletProps {
  expenses: Expense[];
  cards?: PaymentCard[];
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORIES: Category[] = ['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

export const PersonalWallet: React.FC<PersonalWalletProps> = ({
  expenses,
  cards = [],
  onSaveExpense,
  onDeleteExpense,
}) => {
  const { userProfile, activeUserId } = useAuth();

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);

  // Form states for personal expense
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const userCards = useMemo(() => {
    return cards.filter((c) => !c.ownerId || c.ownerId === activeUserId);
  }, [cards, activeUserId]);

  const cardsMap = useMemo(() => {
    const map: Record<string, PaymentCard> = {};
    cards.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [cards]);

  // Filter personal expenses belonging strictly to the active user
  const personalExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.scope === 'personal' && e.ownerId === activeUserId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeUserId]);

  // Available months list for month selector
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonthKey);
    personalExpenses.forEach((exp) => {
      if (exp.date) {
        months.add(exp.date.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [personalExpenses, currentMonthKey]);

  // Filter expenses by selected month/year
  const monthPersonalExpenses = useMemo(() => {
    return personalExpenses.filter((e) => e.date.startsWith(selectedMonth));
  }, [personalExpenses, selectedMonth]);

  // Totals
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
      setPaymentType(exp.paymentMethod?.type || 'cash');
      setSelectedCardId(exp.paymentMethod?.cardId || (userCards[0]?.id || ''));
      setNotes(exp.notes || '');
    } else {
      setEditingExp(null);
      setTitle('');
      setAmountStr('');
      setCategory('Personal');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentType('cash');
      setSelectedCardId(userCards[0]?.id || '');
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
        paymentMethod: {
          type: paymentType,
          cardId: paymentType === 'card' ? (selectedCardId || userCards[0]?.id) : undefined,
        },
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

      {/* Hero Stats & Budget Grid */}
      <div className="grid-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Monthly Personal Outlay with Calendar Month Selector */}
        <div className="glass-card summary-card">
          <div className="summary-card-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="summary-title">Monthly Personal Outlay</span>
              {/* Calendar Icon + Month/Year Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <Calendar size={15} style={{ color: 'var(--accent-purple)' }} />
                <select
                  className="form-select"
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    width: 'auto',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map((mKey) => {
                    const [y, m] = mKey.split('-');
                    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return (
                      <option key={mKey} value={mKey}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="summary-amount tabular-nums" style={{ color: 'var(--accent-purple)', marginTop: '12px' }}>
            {formatCurrency(totalPersonalSpentCents)}
          </div>
          <div className="summary-footer">
            <span>{monthPersonalExpenses.length} personal purchases logged for this month</span>
          </div>
        </div>

        {/* Monthly Budget Target */}
        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Monthly Budget Target</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="tabular-nums" style={{ fontSize: '1.85rem', fontWeight: 800 }}>৳</span>
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
            No personal expenses recorded for the selected month.
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

        {monthPersonalExpenses.length === 0 ? (
          <div className="glass-card empty-state">
            <Wallet className="empty-icon" />
            <div className="empty-title">No Personal Expenses For Selected Month</div>
            <p style={{ fontSize: '0.85rem' }}>Log your private expenses here to manage personal budgets independently.</p>
            <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
              <Plus size={16} /> Add Personal Expense
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {monthPersonalExpenses.map((exp) => {
              const pm = exp.paymentMethod;
              const cardObj = pm?.type === 'card' && pm.cardId ? cardsMap[pm.cardId] : null;

              return (
                <div key={exp.id} className="expense-item-card">
                  <div className="expense-left">
                    <UserAvatar user={userProfile} size={42} />
                    <div className="expense-info-group">
                      <div className="expense-title-row">
                        <span className="expense-title">{exp.title}</span>
                        <span className={`cat-pill cat-${exp.category}`}>{exp.category}</span>

                        {/* Payment Channel Badge */}
                        <span className="share-mini-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                          {pm?.type === 'card' ? (
                            <>
                              <CreditCard size={12} style={{ color: 'var(--accent-primary)' }} />
                              <span>{cardObj ? `${cardObj.bankName} (${cardObj.cardType === 'debit' ? 'Debit' : 'Credit'})` : 'Bank Card'}</span>
                            </>
                          ) : (
                            <>
                              <Banknote size={12} style={{ color: 'var(--accent-emerald)' }} />
                              <span>Cash</span>
                            </>
                          )}
                        </span>
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
              );
            })}
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
                <label className="form-label">Amount (৳)</label>
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

              {/* Payment Channel Selector (Cash vs Bank Card) */}
              <div className="form-group">
                <label className="form-label">Payment Channel</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                    onClick={() => setPaymentType('cash')}
                  >
                    <Banknote size={16} />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                    onClick={() => {
                      setPaymentType('card');
                      if (!selectedCardId && userCards.length > 0) {
                        setSelectedCardId(userCards[0].id);
                      }
                    }}
                  >
                    <CreditCard size={16} />
                    <span>Bank Card</span>
                  </button>
                </div>

                {paymentType === 'card' && (
                  <div style={{ marginTop: '8px' }}>
                    {userCards.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                        No payment cards created yet. Add a card in the "Payment Cards" tab!
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                      >
                        {userCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            💳 {c.bankName} ({c.cardType === 'debit' ? 'Debit' : 'Credit'} Card • {USERS[c.ownerId || activeUserId]?.name || 'Card'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
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
