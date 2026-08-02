import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, Category, PaymentCard, PaymentMethodType } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, dollarsToCents } from '../utils/currency';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { Wallet, Plus, TrendingUp, ShieldCheck, Trash2, Edit, X, CreditCard, Banknote, Calendar, AlertTriangle } from 'lucide-react';
import { toLocalDateKey, toLocalMonthKey } from '../utils/localDate';
import { MaterialSelect } from '../components/MaterialSelect';

interface PersonalWalletProps {
  expenses: Expense[];
  cards?: PaymentCard[];
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  lang?: Language;
}

const CATEGORIES: Category[] = ['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];
const BUDGET_STORAGE_KEY = 'home_finance_personal_budget_v1';
const CAT_BUDGET_STORAGE_KEY = 'home_finance_category_budgets_v1';

export const PersonalWalletPage: React.FC<PersonalWalletProps> = ({
  expenses,
  cards = [],
  onSaveExpense,
  onDeleteExpense,
  lang = 'en',
}) => {
  const { activeUserId, dbUserProfile } = useAuth();
  const myUid = dbUserProfile?.uid || activeUserId;

  const currentMonthKey = toLocalMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);

  // Form states for personal expense
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [date, setDate] = useState(toLocalDateKey());
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Persistent budget target (৳15,000.00 default)
  const [monthlyBudgetTaka, setMonthlyBudgetTaka] = useState<string>(() => {
    return (
      localStorage.getItem(`${BUDGET_STORAGE_KEY}_${myUid}`) ||
      '15000.00'
    );
  });

  // Persistent category monthly budget limits (in Taka strings)
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`${CAT_BUDGET_STORAGE_KEY}_${myUid}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      Groceries: '8000',
      Household: '5000',
      Utilities: '4000',
      Food: '6000',
      Personal: '5000',
      Other: '3000',
    };
  });

  // Save budget targets to localStorage
  useEffect(() => {
    localStorage.setItem(`${BUDGET_STORAGE_KEY}_${myUid}`, monthlyBudgetTaka);
  }, [monthlyBudgetTaka, myUid]);

  useEffect(() => {
    localStorage.setItem(`${CAT_BUDGET_STORAGE_KEY}_${myUid}`, JSON.stringify(categoryBudgets));
  }, [categoryBudgets, myUid]);

  const userCards = useMemo(() => {
    return cards.filter((c) => c.ownerId === myUid);
  }, [cards, myUid]);

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
      .filter((e) => e.scope === 'personal' && e.ownerId === myUid && e.paidBy === myUid)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, myUid]);

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

  const monthlyBudgetCents = dollarsToCents(monthlyBudgetTaka);
  const budgetRatioPercent = monthlyBudgetCents > 0 ? (totalPersonalSpentCents / monthlyBudgetCents) * 100 : 0;

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
      setDate(toLocalDateKey());
      setPaymentType('cash');
      setSelectedCardId(userCards[0]?.id || '');
      setNotes('');
    }
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amountStr.trim()) return;

    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) return;

    const cents = dollarsToCents(val);

    onSaveExpense(
      {
        title: title.trim(),
        amountCents: cents,
        paidBy: myUid,
        category,
        date,
        splitMethod: 'equal',
        shares: [{ userId: myUid, amountCents: cents }],
        scope: 'personal',
        ownerId: myUid,
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
      {/* Header Banner */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Wallet size={28} style={{ color: 'var(--accent-purple)' }} />
            <div>
              <h1 className="page-title">{getTranslation('personalWallet', lang)}</h1>
              <p className="page-description">
                Private individual budget tracker for personal purchases (not shared with housemates)
              </p>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
          <Plus size={18} />
          <span>Log Personal Expense</span>
        </button>
      </div>

      {/* Hero Stats & Budget Grid */}
      <div className="grid-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Monthly Personal Outlay with Calendar Month Selector */}
        <div className="glass-card summary-card">
          <div className="summary-card-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="summary-title">Monthly Personal Outlay</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <Calendar size={15} style={{ color: 'var(--accent-purple)' }} />
                <MaterialSelect
                  compact
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  ariaLabel="Personal wallet month"
                  style={{ width: 'auto', minWidth: '150px' }}
                  options={availableMonths.map((mKey) => {
                    const [y, m] = mKey.split('-');
                    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return { value: mKey, label };
                  })}
                />
              </div>
            </div>

            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="summary-amount tabular-nums" style={{ color: 'var(--accent-purple)', marginTop: '12px' }}>
            {formatCurrency(totalPersonalSpentCents, false, lang)}
          </div>
          <div className="summary-footer">
            <span>{monthPersonalExpenses.length} personal purchases logged for this month</span>
          </div>
        </div>

        {/* Monthly Budget Target */}
        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">{getTranslation('monthlyBudgetTarget', lang)}</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="tabular-nums" style={{ fontSize: '1.85rem', fontWeight: 800 }}>৳</span>
            <input
              type="number"
              step="100"
              className="form-input tabular-nums"
              style={{ fontSize: '1.5rem', fontWeight: 800, padding: '4px 8px', width: '150px' }}
              value={monthlyBudgetTaka}
              onChange={(e) => setMonthlyBudgetTaka(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>{getTranslation('budgetUsed', lang)}</span>
              <span>{budgetRatioPercent.toFixed(0)}%</span>
            </div>

            <div className="progress-bar-bg" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, budgetRatioPercent)}%`,
                  backgroundColor:
                    budgetRatioPercent >= 100
                      ? 'var(--accent-rose)'
                      : budgetRatioPercent >= 80
                      ? 'var(--accent-amber)'
                      : 'var(--accent-emerald)',
                }}
              />
            </div>

            {budgetRatioPercent >= 80 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.75rem', color: budgetRatioPercent >= 100 ? 'var(--accent-rose)' : 'var(--accent-amber)', fontWeight: 700 }}>
                <AlertTriangle size={14} />
                <span>{budgetRatioPercent >= 100 ? getTranslation('overBudgetWarning', lang) : getTranslation('nearBudgetWarning', lang)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-Category Monthly Budget Threshold Limits Grid */}
      <div className="glass-card">
        <h3 className="section-title" style={{ marginBottom: '14px' }}>
          {getTranslation('categoryBudgets', lang)}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {CATEGORIES.map((cat) => {
            const spentCents = categoryTotals[cat] || 0;
            const limitStr = categoryBudgets[cat] || '5000';
            const limitCents = dollarsToCents(limitStr);
            const ratio = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;

            return (
              <div
                key={cat}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: ratio >= 100 ? '1px solid var(--accent-rose)' : ratio >= 80 ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{cat}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Limit: ৳</span>
                    <input
                      type="number"
                      step="100"
                      className="form-input tabular-nums"
                      style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                      value={limitStr}
                      onChange={(e) => setCategoryBudgets({ ...categoryBudgets, [cat]: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>Spent: <strong>{formatCurrency(spentCents, false, lang)}</strong></span>
                  <span style={{ fontWeight: 700, color: ratio >= 100 ? 'var(--accent-rose)' : ratio >= 80 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                    {ratio.toFixed(0)}%
                  </span>
                </div>

                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(100, ratio)}%`,
                      backgroundColor:
                        ratio >= 100
                          ? 'var(--accent-rose)'
                          : ratio >= 80
                          ? 'var(--accent-amber)'
                          : 'var(--accent-primary)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History List */}
      <div className="glass-card">
        <h3 className="section-title" style={{ marginBottom: '16px' }}>
          Personal Purchase Audit History
        </h3>

        {monthPersonalExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No personal purchases logged for {selectedMonth}. Click "Log Personal Expense" above to add one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {monthPersonalExpenses.map((exp) => {
              const cardObj = exp.paymentMethod?.cardId ? cardsMap[exp.paymentMethod.cardId] : null;

              return (
                <div
                  key={exp.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className={`cat-pill cat-${exp.category}`} style={{ fontSize: '0.75rem' }}>
                      {exp.category}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>{exp.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{exp.date}</span>
                        {exp.paymentMethod?.type === 'card' ? (
                          <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CreditCard size={12} />
                            {cardObj ? cardObj.bankName : getTranslation('deletedCardBadge', lang)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Banknote size={12} />
                            Cash
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-purple)' }}>
                      {formatCurrency(exp.amountCents, false, lang)}
                    </div>
                    <button className="btn btn-secondary btn-icon-only" onClick={() => handleOpenAdd(exp)} title="Edit">
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger btn-icon-only" onClick={() => onDeleteExpense(exp.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
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
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingExp ? 'Edit Personal Expense' : 'Log Personal Purchase'}</h3>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Item / Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Coffee, Book, Gym Membership"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Amount (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input tabular-nums"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <MaterialSelect
                    value={category}
                    onChange={setCategory}
                    ariaLabel="Personal expense category"
                    options={CATEGORIES.map((item) => ({ value: item, label: item }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Channel</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPaymentType('cash')}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPaymentType('card')}
                  >
                    Bank Card
                  </button>
                </div>

                {paymentType === 'card' && userCards.length > 0 && (
                  <MaterialSelect
                    value={selectedCardId}
                    onChange={setSelectedCardId}
                    ariaLabel="Personal expense payment card"
                    style={{ marginTop: '10px' }}
                    options={userCards.map((card) => ({ value: card.id, label: `💳 ${card.bankName}` }))}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Personal Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
