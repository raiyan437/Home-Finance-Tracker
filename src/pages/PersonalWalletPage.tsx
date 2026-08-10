import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, Category, PaymentCard, PaymentMethodType } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, dollarsToCents } from '../utils/currency';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { Wallet, Plus, TrendingUp, ShieldCheck, Trash2, Edit, X, CreditCard, Banknote, Calendar, AlertTriangle, Save, CircleDollarSign, CheckCircle2 } from 'lucide-react';
import { toLocalDateKey, toLocalMonthKey } from '../utils/localDate';
import { MaterialSelect } from '../components/MaterialSelect';
import { calculateCashInHandCents, createCashOpeningBalance } from '../features/personalWalletLedger';
import { calculatePersonalBudgetUsage } from '../features/personalBudget';

interface PersonalWalletProps {
  expenses: Expense[];
  cards?: PaymentCard[];
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  lang?: Language;
}

const CATEGORIES: Category[] = ['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

export const PersonalWalletPage: React.FC<PersonalWalletProps> = ({
  expenses,
  cards = [],
  onSaveExpense,
  onDeleteExpense,
  lang = 'en',
}) => {
  const { activeUserId, dbUserProfile, updatePersonalWalletSettings } = useAuth();
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

  const [monthlyBudgetTaka, setMonthlyBudgetTaka] = useState('');
  const [cashInputTaka, setCashInputTaka] = useState('');
  const [savingWalletSetting, setSavingWalletSetting] = useState<'cash' | 'budget' | null>(null);
  const [walletSettingNotice, setWalletSettingNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const budgetCents = dbUserProfile?.walletSettings?.monthlyBudgetCents;
    const cashCents = dbUserProfile?.walletSettings?.cashOpeningBalanceCents
      ?? dbUserProfile?.walletSettings?.cashBalanceCents;
    setMonthlyBudgetTaka(budgetCents === undefined ? '' : (budgetCents / 100).toFixed(2));
    setCashInputTaka(cashCents === undefined ? '' : (cashCents / 100).toFixed(2));
  }, [
    myUid,
    dbUserProfile?.walletSettings?.monthlyBudgetCents,
    dbUserProfile?.walletSettings?.cashOpeningBalanceCents,
    dbUserProfile?.walletSettings?.cashBalanceCents,
  ]);

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

  const monthlyBudgetCents = dbUserProfile?.walletSettings?.monthlyBudgetCents;
  const budgetUsage = calculatePersonalBudgetUsage(personalExpenses, selectedMonth, monthlyBudgetCents);
  const budgetIsSet = budgetUsage.isSet;
  const budgetRatioPercent = budgetUsage.ratioPercent;
  const cashInHandCents = calculateCashInHandCents(dbUserProfile?.walletSettings, personalExpenses);

  const saveWalletAmount = async (kind: 'cash' | 'budget') => {
    const rawValue = kind === 'cash' ? cashInputTaka : monthlyBudgetTaka;
    const parsed = Number(rawValue);
    if (!rawValue.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setWalletSettingNotice({ tone: 'error', message: 'Enter a valid amount of zero or more before saving.' });
      return;
    }

    setSavingWalletSetting(kind);
    setWalletSettingNotice(null);
    try {
      const cents = dollarsToCents(parsed);
      await updatePersonalWalletSettings(
        kind === 'cash'
          ? createCashOpeningBalance(cents)
          : { monthlyBudgetCents: cents }
      );
      setWalletSettingNotice({
        tone: 'success',
        message: kind === 'cash' ? 'Cash in hand saved.' : 'Monthly budget target saved.',
      });
    } catch (error) {
      setWalletSettingNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save the wallet setting.',
      });
    } finally {
      setSavingWalletSetting(null);
    }
  };

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
        notes: notes.trim() || undefined,
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

        {/* Cash in hand */}
        <div className="glass-card summary-card wallet-setting-card">
          <div className="summary-card-header">
            <span className="summary-title">Cash in hand</span>
            <div className="summary-icon-box wallet-cash-icon">
              <CircleDollarSign size={20} />
            </div>
          </div>
          <div className={`summary-amount tabular-nums wallet-cash-balance ${cashInHandCents !== null && cashInHandCents < 0 ? 'is-negative' : ''}`}>
            {cashInHandCents === null ? 'Not set' : formatCurrency(cashInHandCents, false, lang)}
          </div>
          <p className="wallet-setting-help">Set an opening cash balance. Only cash purchases on or after that opening date deduct from it; card purchases do not.</p>
          <div className="wallet-setting-form">
            <div className="wallet-currency-input">
              <span>৳</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input tabular-nums"
                placeholder="Enter cash amount"
                value={cashInputTaka}
                onChange={(event) => setCashInputTaka(event.target.value)}
                aria-label="Cash in hand amount"
              />
            </div>
            <button type="button" className="btn btn-primary wallet-save-button" onClick={() => void saveWalletAmount('cash')} disabled={savingWalletSetting !== null || !cashInputTaka.trim()}>
              <Save size={16} />
              <span>{savingWalletSetting === 'cash' ? 'Saving…' : 'Save'}</span>
            </button>
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
          <p className="wallet-setting-help">Set the monthly target used by the selected-month budget progress indicator. Cash and card purchases both count.</p>
          <div className="wallet-setting-form">
            <div className="wallet-currency-input">
              <span>৳</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input tabular-nums"
                placeholder="Enter monthly budget"
                value={monthlyBudgetTaka}
                onChange={(event) => setMonthlyBudgetTaka(event.target.value)}
                aria-label="Monthly personal budget target"
              />
            </div>
            <button type="button" className="btn btn-primary wallet-save-button" onClick={() => void saveWalletAmount('budget')} disabled={savingWalletSetting !== null || !monthlyBudgetTaka.trim()}>
              <Save size={16} />
              <span>{savingWalletSetting === 'budget' ? 'Saving…' : 'Save'}</span>
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>{getTranslation('budgetUsed', lang)}</span>
              <span>{budgetIsSet ? `${budgetRatioPercent.toFixed(0)}%` : 'Not set'}</span>
            </div>

            <div className="progress-bar-bg" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: budgetIsSet ? `${Math.min(100, budgetRatioPercent)}%` : '0%',
                  backgroundColor:
                    budgetRatioPercent >= 100
                      ? 'var(--accent-rose)'
                      : budgetRatioPercent >= 80
                      ? 'var(--accent-amber)'
                      : 'var(--accent-emerald)',
                }}
              />
            </div>

            {budgetIsSet && budgetRatioPercent >= 80 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.75rem', color: budgetRatioPercent >= 100 ? 'var(--accent-rose)' : 'var(--accent-amber)', fontWeight: 700 }}>
                <AlertTriangle size={14} />
                <span>{budgetRatioPercent >= 100 ? getTranslation('overBudgetWarning', lang) : getTranslation('nearBudgetWarning', lang)}</span>
              </div>
            )}
            {budgetIsSet && monthlyBudgetCents === 0 && totalPersonalSpentCents > 0 && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 700 }}>
                Budget target is ৳0.00; selected-month spending exceeds the target.
              </div>
            )}
          </div>
        </div>
      </div>

      {walletSettingNotice && (
        <div className={`wallet-setting-message ${walletSettingNotice.tone === 'error' ? 'is-error' : ''}`} role="status">
          {walletSettingNotice.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{walletSettingNotice.message}</span>
        </div>
      )}

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
                    <button className="btn record-action-button record-action-edit" onClick={() => handleOpenAdd(exp)} title="Edit expense">
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                    <button className="btn record-action-button record-action-delete" onClick={() => onDeleteExpense(exp.id)} title="Delete expense">
                      <Trash2 size={14} />
                      <span>Delete</span>
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
                  {editingExp ? <Edit size={17} /> : <Plus size={17} />}
                  <span>{editingExp ? 'Save Changes' : 'Save Personal Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
