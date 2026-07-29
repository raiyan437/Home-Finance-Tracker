import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, UserId, Category, SplitMethod, Share, ExpenseScope, PaymentCard, PaymentMethodType, RecurringFrequency } from '../types';
import { getHouseUsers, USERS } from '../utils/settlementEngine';
import { useAuth } from '../context/AuthContext';
import {
  dollarsToCents,
  validateCustomSplits,
  formatCurrency,
} from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { scanReceiptImage } from '../utils/ocrScanner';
import { X, Check, AlertCircle, Sparkles, Users, Wallet, CreditCard, Banknote, Image as ImageIcon } from 'lucide-react';

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
  const { currentHouse, activeUserId } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse), [currentHouse]);

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState<UserId>(activeUserId || 'raiyan');
  const [category, setCategory] = useState<Category>('Groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [scope, setScope] = useState<ExpenseScope>('household');
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<UserId[]>([]);
  const [customSharesStr, setCustomSharesStr] = useState<Record<UserId, string>>({});
  const [percentagesStr, setPercentagesStr] = useState<Record<UserId, string>>({});
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    const allUserIds = houseUsers.map((u) => u.id);

    if (initialExpense) {
      setTitle(initialExpense.title || '');
      setAmountStr((initialExpense.amountCents / 100).toFixed(2));
      setPaidBy(initialExpense.paidBy || activeUserId || allUserIds[0] || 'raiyan');
      setCategory(initialExpense.category || 'Groceries');
      setDate(initialExpense.date || new Date().toISOString().split('T')[0]);
      setSplitMethod(initialExpense.splitMethod || 'equal');
      setScope(initialExpense.scope || 'household');
      setPaymentType(initialExpense.paymentMethod?.type || 'cash');
      setSelectedCardId(initialExpense.paymentMethod?.cardId || (cards[0]?.id || ''));
      setIsRecurring(Boolean(initialExpense.isRecurring));
      setRecurringFrequency(initialExpense.recurringFrequency || 'monthly');
      setReceiptUrl(initialExpense.receiptUrl || '');
      setNotes(initialExpense.notes || '');

      const partIds: UserId[] = initialExpense.shares && initialExpense.shares.length > 0
        ? initialExpense.shares.map((s) => s.userId)
        : allUserIds;
      setSelectedParticipants(partIds);

      const customObj: Record<UserId, string> = {};
      const percObj: Record<UserId, string> = {};

      allUserIds.forEach((id) => {
        customObj[id] = '';
        percObj[id] = (100 / Math.max(1, allUserIds.length)).toFixed(2);
      });

      if (initialExpense.shares) {
        initialExpense.shares.forEach((s) => {
          customObj[s.userId] = (s.amountCents / 100).toFixed(2);
          if (s.percentage !== undefined) {
            percObj[s.userId] = s.percentage.toString();
          }
        });
      }
      setCustomSharesStr(customObj);
      setPercentagesStr(percObj);
    } else {
      // Reset defaults dynamically based on active house users
      setTitle('');
      setAmountStr('');
      setPaidBy(activeUserId || allUserIds[0] || 'raiyan');
      setCategory('Groceries');
      setDate(new Date().toISOString().split('T')[0]);
      setSplitMethod('equal');
      setScope('household');
      setPaymentType('cash');
      setSelectedCardId(cards[0]?.id || '');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setReceiptUrl('');
      setSelectedParticipants(allUserIds);

      const customObj: Record<UserId, string> = {};
      const percObj: Record<UserId, string> = {};
      const equalPerc = (100 / Math.max(1, allUserIds.length)).toFixed(2);

      allUserIds.forEach((id) => {
        customObj[id] = '';
        percObj[id] = equalPerc;
      });

      setCustomSharesStr(customObj);
      setPercentagesStr(percObj);
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen, initialExpense, houseUsers, activeUserId, cards]);

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

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setErrorMessage('Receipt image size should be less than 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const b64 = reader.result as string;
        setReceiptUrl(b64);
        setIsScanningOcr(true);
        const parsed = await scanReceiptImage(b64);
        setIsScanningOcr(false);
        if (parsed.success) {
          if (parsed.title) setTitle(parsed.title);
          if (parsed.amountCents) setAmountStr((parsed.amountCents / 100).toFixed(2));
          if (parsed.date) setDate(parsed.date);
        }
      };
      reader.readAsDataURL(file);
    }
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
      setErrorMessage('Please enter a valid amount greater than ৳0.');
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
        const count = selectedParticipants.length;
        const baseShare = Math.floor(totalCents / count);
        const remainder = totalCents % count;
        const primaryPayerId = selectedParticipants.includes(paidBy) ? paidBy : selectedParticipants[0];

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: baseShare + (userId === primaryPayerId ? remainder : 0),
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
          amountCents: customSharesCents[userId] || 0,
        }));
      } else if (splitMethod === 'percentage') {
        const percMap: Record<string, number> = {};
        selectedParticipants.forEach((userId) => {
          percMap[userId] = parseFloat(percentagesStr[userId] || '0');
        });

        const totalPercent = Object.values(percMap).reduce((a, b) => a + b, 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          setErrorMessage('Percentages must total exactly 100%.');
          return;
        }

        const primaryPayerId = selectedParticipants.includes(paidBy) ? paidBy : selectedParticipants[0];
        let sumAssigned = 0;
        const tempShares: Record<string, number> = {};

        selectedParticipants.forEach((userId) => {
          const cents = Math.floor((totalCents * (percMap[userId] || 0)) / 100);
          tempShares[userId] = cents;
          sumAssigned += cents;
        });

        const remainder = totalCents - sumAssigned;
        tempShares[primaryPayerId] = (tempShares[primaryPayerId] || 0) + remainder;

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: tempShares[userId] || 0,
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
        ownerId: activeUserId,
        paymentMethod: {
          type: paymentType,
          cardId: paymentType === 'card' ? selectedCardId : undefined,
        },
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        receiptUrl: receiptUrl || undefined,
        notes: notes.trim() || undefined,
      },
      initialExpense?.id
    );

    onClose();
  };

  const liveTotalCents = dollarsToCents(amountStr);
  const liveEqualShareCents =
    selectedParticipants.length > 0 ? Math.round(liveTotalCents / selectedParticipants.length) : 0;

  return (
    <div className="modal-backdrop">
      <div className="glass-card modal-card" style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {initialExpense ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Log shared household outlays or private personal purchases
            </p>
          </div>
          <button className="btn btn-secondary btn-icon-only" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Scope Selector: Shared Household vs Private Personal */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            className={`btn ${scope === 'household' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '10px', fontSize: '0.88rem' }}
            onClick={() => setScope('household')}
          >
            <Users size={18} />
            <span>Shared Household Expense</span>
          </button>

          <button
            type="button"
            className={`btn ${scope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '10px', fontSize: '0.88rem' }}
            onClick={() => setScope('personal')}
          >
            <Wallet size={18} />
            <span>Private Personal Expense</span>
          </button>
        </div>

        {/* Quick Template Presets Bar */}
        {!initialExpense && scope === 'household' && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} />
              <span>Quick Template Presets</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => applyPreset(p)}
                >
                  {p.name} (৳{p.amount})
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600 }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

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
              />
            </div>
          </div>

          {/* Paid By Selection Grid */}
          <div className="form-group">
            <label className="form-label">Who Paid Out-of-Pocket?</label>
            <div className="user-selector-grid">
              {houseUsers.map((user) => (
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
                        💳 {c.bankName} ({c.cardType === 'debit' ? 'Debit' : 'Credit'} Card • {USERS[c.ownerId || activeUserId]?.name || 'Card'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* AI OCR Scanner & Receipt Attachment */}
          <div className="form-group">
            <label className="form-label">Receipt Photo & AI OCR Scanner</label>
            {receiptUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                <img src={receiptUrl} alt="Receipt" style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Receipt Attached</div>
                  <div style={{ fontSize: '0.75rem', color: isScanningOcr ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                    {isScanningOcr ? 'Scanning receipt text via OCR...' : '✓ OCR scan completed'}
                  </div>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setReceiptUrl('')}>
                  Remove
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-medium)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <ImageIcon size={18} />
                <span>Upload or Snap Receipt Image</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReceiptUpload} />
              </label>
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
                  {houseUsers.filter((u) => u.id !== paidBy).map((u) => (
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
                  {houseUsers.map((user) => {
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
                    Custom (৳)
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
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Custom Taka Amounts</div>
                  {selectedParticipants.map((userId) => {
                    const uObj = houseUsers.find((u) => u.id === userId);
                    return (
                      <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontWeight: 700 }}>{uObj?.name || USERS[userId]?.name || userId}</span>
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
                    );
                  })}
                </div>
              )}

              {splitMethod === 'percentage' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Percentage Share Allocations</div>
                  {selectedParticipants.map((userId) => {
                    const uObj = houseUsers.find((u) => u.id === userId);
                    return (
                      <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontWeight: 700 }}>{uObj?.name || USERS[userId]?.name || userId}</span>
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
                    );
                  })}
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
              placeholder="e.g. Bought from Shwapno Supermarket"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {initialExpense ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
