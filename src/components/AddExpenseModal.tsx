import React, { useState, useEffect } from 'react';
import type { Expense, UserId, Category, SplitMethod, Share, ExpenseScope, PaymentCard, PaymentMethodType } from '../types';
import { ALL_USERS, USERS } from '../utils/settlementEngine';
import { useAuth } from '../context/AuthContext';
import {
  dollarsToCents,
  calculateEqualSplits,
  validateCustomSplits,
  calculatePercentageSplits,
  formatCurrency,
} from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { X, Check, AlertCircle, Sparkles, Receipt, Users, Wallet, CreditCard, Banknote } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  initialExpense?: Expense | null;
  cards?: PaymentCard[];
}

const CATEGORIES: Category[] = ['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

const PRESETS = [
  { name: 'Weekly Groceries', amount: '120.00', category: 'Groceries' as Category },
  { name: 'WiFi Internet Bill', amount: '45.00', category: 'Utilities' as Category },
  { name: 'Electricity & Gas', amount: '85.50', category: 'Utilities' as Category },
  { name: 'House Supplies & Clean', amount: '35.00', category: 'Household' as Category },
  { name: 'Friday Takeout Food', amount: '54.00', category: 'Food' as Category },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  initialExpense,
  cards = [],
}) => {
  const { activeUserId } = useAuth();

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState<UserId>(activeUserId);
  const [category, setCategory] = useState<Category>('Groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [scope, setScope] = useState<ExpenseScope>('household');
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<UserId[]>(['raiyan', 'himel', 'lazim']);
  const [customSharesStr, setCustomSharesStr] = useState<Record<UserId, string>>({
    raiyan: '',
    himel: '',
    lazim: '',
  });
  const [percentagesStr, setPercentagesStr] = useState<Record<UserId, string>>({
    raiyan: '33.33',
    himel: '33.33',
    lazim: '33.34',
  });
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when opening or editing
  useEffect(() => {
    if (initialExpense) {
      setTitle(initialExpense.title);
      setAmountStr((initialExpense.amountCents / 100).toFixed(2));
      setPaidBy(initialExpense.paidBy);
      setCategory(initialExpense.category);
      setDate(initialExpense.date);
      setSplitMethod(initialExpense.splitMethod);
      setScope(initialExpense.scope || 'household');
      setPaymentType(initialExpense.paymentMethod?.type || 'cash');
      setSelectedCardId(initialExpense.paymentMethod?.cardId || (cards[0]?.id || ''));
      setNotes(initialExpense.notes || '');

      const partIds = initialExpense.shares.map((s) => s.userId);
      setSelectedParticipants(partIds);

      const customObj: Record<UserId, string> = { raiyan: '', himel: '', lazim: '' };
      const percObj: Record<UserId, string> = { raiyan: '', himel: '', lazim: '' };

      initialExpense.shares.forEach((s) => {
        customObj[s.userId] = (s.amountCents / 100).toFixed(2);
        if (s.percentage !== undefined) {
          percObj[s.userId] = s.percentage.toString();
        }
      });
      setCustomSharesStr(customObj);
      setPercentagesStr(percObj);
    } else {
      // Reset defaults
      setTitle('');
      setAmountStr('');
      setPaidBy(activeUserId);
      setCategory('Groceries');
      setDate(new Date().toISOString().split('T')[0]);
      setSplitMethod('equal');
      setScope('household');
      setPaymentType('cash');
      setSelectedCardId(cards[0]?.id || '');
      setSelectedParticipants(['raiyan', 'himel', 'lazim']);
      setCustomSharesStr({ raiyan: '', himel: '', lazim: '' });
      setPercentagesStr({ raiyan: '33.33', himel: '33.33', lazim: '33.34' });
      setNotes('');
      setErrorMessage(null);
    }
  }, [initialExpense, isOpen, activeUserId, cards]);

  if (!isOpen) return null;

  const toggleParticipant = (userId: UserId) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length === 1) {
        setErrorMessage('At least one participant must benefit from the expense.');
        return;
      }
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handlePersonalShortcut = (beneficiaryId: UserId) => {
    setCategory('Personal');
    setSelectedParticipants([beneficiaryId]);
    setSplitMethod('equal');
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(preset.name);
    setAmountStr(preset.amount);
    setCategory(preset.category);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const totalCents = dollarsToCents(amountStr);
    if (!title.trim()) {
      setErrorMessage('Please enter an expense name.');
      return;
    }
    if (totalCents <= 0) {
      setErrorMessage('Please enter a valid amount greater than $0.');
      return;
    }

    let finalShares: Share[] = [];

    if (scope === 'personal') {
      finalShares = [{ userId: paidBy, amountCents: totalCents }];
    } else {
      if (selectedParticipants.length === 0) {
        setErrorMessage('Please select at least one participant.');
        return;
      }

      if (splitMethod === 'equal') {
        const splitMap = calculateEqualSplits(totalCents, selectedParticipants);
        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: splitMap[userId],
        }));
      } else if (splitMethod === 'custom') {
        const customSharesCents: Record<string, number> = {};
        selectedParticipants.forEach((userId) => {
          customSharesCents[userId] = dollarsToCents(customSharesStr[userId] || 0);
        });

        const validation = validateCustomSplits(totalCents, customSharesCents);
        if (!validation.isValid) {
          const diffDollars = formatCurrency(Math.abs(validation.differenceCents));
          setErrorMessage(
            `Custom split total does not match the expense amount. Difference: ${diffDollars} (${
              validation.differenceCents > 0 ? 'under-allocated' : 'over-allocated'
            }).`
          );
          return;
        }

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: customSharesCents[userId],
        }));
      } else if (splitMethod === 'percentage') {
        const percMap: Record<string, number> = {};
        selectedParticipants.forEach((userId) => {
          percMap[userId] = parseFloat(percentagesStr[userId] || '0');
        });

        const { shares, is100Percent } = calculatePercentageSplits(totalCents, percMap);
        if (!is100Percent) {
          setErrorMessage('Percentages must total exactly 100%.');
          return;
        }

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: shares[userId],
          percentage: percMap[userId],
        }));
      }
    }

    onSaveExpense(
      {
        title: title.trim(),
        amountCents: totalCents,
        paidBy,
        category,
        date,
        splitMethod: scope === 'personal' ? 'equal' : splitMethod,
        shares: finalShares,
        scope,
        ownerId: paidBy,
        paymentMethod: {
          type: paymentType,
          cardId: paymentType === 'card' ? (selectedCardId || cards[0]?.id) : undefined,
        },
        notes: notes.trim(),
      },
      initialExpense ? initialExpense.id : undefined
    );

    onClose();
  };

  // Preview split calculations live
  const liveTotalCents = dollarsToCents(amountStr);
  const liveEqualShareCents = selectedParticipants.length > 0 ? Math.round(liveTotalCents / selectedParticipants.length) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Receipt size={22} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="modal-title">{initialExpense ? 'Edit Expense' : 'Log New Expense'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Expense Scope Selector (Household Shared vs Personal Private) */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            className={`btn ${scope === 'household' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
            onClick={() => setScope('household')}
          >
            <Users size={16} />
            <span>Shared Household</span>
          </button>
          <button
            type="button"
            className={`btn ${scope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
            onClick={() => setScope('personal')}
          >
            <Wallet size={16} style={{ color: 'var(--accent-purple)' }} />
            <span>Private Personal</span>
          </button>
        </div>

        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--status-negative-text)', backgroundColor: 'var(--status-negative-bg)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--status-negative-border)', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Preset Chips */}
        {!initialExpense && scope === 'household' && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} />
              <span>Quick Preset Templates</span>
            </div>
            <div className="form-presets-row">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.name} (${p.amount})
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Title & Amount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Expense Name / Item</label>
              <input
                type="text"
                className="form-input"
                placeholder={scope === 'personal' ? 'e.g. Personal Coffee, Shopping' : 'e.g. Weekly Groceries, Gas Bill'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
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
              />
            </div>
          </div>

          {/* Paid By Selection Grid */}
          <div className="form-group">
            <label className="form-label">Who Paid Out-of-Pocket?</label>
            <div className="user-selector-grid">
              {ALL_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`user-select-btn ${paidBy === user.id ? 'selected' : ''}`}
                  onClick={() => setPaidBy(user.id)}
                >
                  <UserAvatar user={user} size={28} />
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector (Cash vs Bank Card) */}
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
                  if (!selectedCardId && cards.length > 0) {
                    setSelectedCardId(cards[0].id);
                  }
                }}
              >
                <CreditCard size={16} />
                <span>Bank Card</span>
              </button>
            </div>

            {paymentType === 'card' && (
              <div style={{ marginTop: '8px' }}>
                {cards.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    No cards created yet. Go to "Payment Cards" tab to add your bank cards!
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        💳 {c.bankName} ({USERS[c.ownerId || activeUserId]?.name || 'Card'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Category & Date Row */}
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

          {scope === 'household' && (
            <>
              {/* Quick Personal Purchase Shortcut */}
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Personal Purchase Shortcut
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ALL_USERS.filter((u) => u.id !== paidBy).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handlePersonalShortcut(u.id)}
                    >
                      <span>Bought only for {u.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants Checklist */}
              <div className="form-group">
                <label className="form-label">
                  <span>Participants (Beneficiaries)</span>
                  {splitMethod === 'equal' && liveTotalCents > 0 && (
                    <span style={{ color: 'var(--accent-primary)' }}>~{formatCurrency(liveEqualShareCents)} / person</span>
                  )}
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ALL_USERS.map((user) => {
                    const isChecked = selectedParticipants.includes(user.id);
                    return (
                      <div key={user.id} className="participant-checkbox-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <UserAvatar user={user} size={28} />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</span>
                        </div>

                        <button
                          type="button"
                          className={`btn ${isChecked ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => toggleParticipant(user.id)}
                        >
                          {isChecked ? <Check size={14} /> : null}
                          <span>{isChecked ? 'Included' : 'Exclude'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Split Method Selector */}
              <div className="form-group">
                <label className="form-label">Split Allocation Method</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSplitMethod('equal')}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSplitMethod('custom')}
                  >
                    Custom ($)
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'percentage' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSplitMethod('percentage')}
                  >
                    Percentage (%)
                  </button>
                </div>
              </div>

              {/* Custom / Percentage Inputs */}
              {splitMethod === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Custom Dollar Amounts</div>
                  {selectedParticipants.map((userId) => (
                    <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontWeight: 700 }}>{USERS[userId].name}</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input tabular-nums"
                        style={{ width: '130px' }}
                        placeholder="0.00"
                        value={customSharesStr[userId] || ''}
                        onChange={(e) =>
                          setCustomSharesStr({ ...customSharesStr, [userId]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {splitMethod === 'percentage' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Percentage Share Allocations</div>
                  {selectedParticipants.map((userId) => (
                    <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontWeight: 700 }}>{USERS[userId].name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          step="0.1"
                          className="form-input tabular-nums"
                          style={{ width: '100px' }}
                          placeholder="0"
                          value={percentagesStr[userId] || ''}
                          onChange={(e) =>
                            setPercentagesStr({ ...percentagesStr, [userId]: e.target.value })
                          }
                        />
                        <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Optional Notes */}
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Receipt breakdown or extra context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {initialExpense ? 'Save Changes' : scope === 'personal' ? 'Save Personal Expense' : 'Confirm Shared Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
