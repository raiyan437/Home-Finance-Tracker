import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, UserId, Category, SplitMethod, Share, ExpenseScope, PaymentCard, PaymentMethodType, RecurringFrequency } from '../types';
import { getHouseUsers } from '../utils/settlementEngine';
import { useAuth } from '../context/AuthContext';
import {
  dollarsToCents,
  validateCustomSplits,
  formatCurrency,
  calculateEqualSplits,
  calculatePercentageSplits,
} from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { scanReceiptImage } from '../utils/ocrScanner';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { X, Check, AlertCircle, Sparkles, Users, Wallet, CreditCard, Banknote, Image as ImageIcon } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => void;
  initialExpense?: Expense | null;
  cards?: PaymentCard[];
  lang?: Language;
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
  lang = 'en',
}) => {
  const { currentHouse, activeUserId, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Background body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsSubmitting(false);

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
      setNotes('');
      setSelectedParticipants(allUserIds);

      const customObj: Record<UserId, string> = {};
      const percObj: Record<UserId, string> = {};
      const defaultPerc = (100 / Math.max(1, allUserIds.length)).toFixed(2);

      allUserIds.forEach((id) => {
        customObj[id] = '';
        percObj[id] = defaultPerc;
      });

      setCustomSharesStr(customObj);
      setPercentagesStr(percObj);
    }
  }, [isOpen, initialExpense, houseUsers, activeUserId, cards]);

  const toggleParticipant = (userId: UserId) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length <= 1) return;
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setTitle(preset.name);
    setAmountStr(preset.amount);
    setCategory(preset.category);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Invalid file format. Please upload an image file (JPEG, PNG, WebP).');
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setErrorMessage('File size exceeds 3MB limit. Please select a smaller receipt image.');
        return;
      }

      setIsScanningOcr(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setReceiptUrl(base64);
        const parsed = await scanReceiptImage(base64);
        setIsScanningOcr(false);
        if (parsed.success) {
          if (parsed.title) setTitle((prev) => prev || parsed.title || '');
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

    setIsSubmitting(true);
    let finalShares: Share[] = [];

    if (scope === 'personal') {
      if (paidBy !== activeUserId) {
        const eqSplits = calculateEqualSplits(totalCents, [paidBy, activeUserId]);
        finalShares = [
          { userId: paidBy, amountCents: eqSplits[paidBy] || 0 },
          { userId: activeUserId, amountCents: eqSplits[activeUserId] || 0 },
        ];
      } else {
        finalShares = [{ userId: activeUserId, amountCents: totalCents }];
      }
    } else {
      if (selectedParticipants.length === 0) {
        setErrorMessage('Please select at least one participant.');
        setIsSubmitting(false);
        return;
      }

      if (splitMethod === 'equal') {
        const eqSplits = calculateEqualSplits(totalCents, selectedParticipants);
        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: eqSplits[userId] || 0,
        }));
      } else if (splitMethod === 'custom') {
        const customSharesCents: Record<string, number> = {};
        let hasNegative = false;

        selectedParticipants.forEach((userId) => {
          const valCents = dollarsToCents(customSharesStr[userId] || 0);
          if (valCents < 0) hasNegative = true;
          customSharesCents[userId] = valCents;
        });

        if (hasNegative) {
          setErrorMessage('Custom share amounts cannot be negative.');
          setIsSubmitting(false);
          return;
        }

        const validation = validateCustomSplits(totalCents, customSharesCents);
        if (!validation.isValid) {
          const diffDollars = formatCurrency(Math.abs(validation.differenceCents), false, lang);
          setErrorMessage(
            `Custom split total does not match expense amount. Difference: ${diffDollars}.`
          );
          setIsSubmitting(false);
          return;
        }

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: customSharesCents[userId] || 0,
        }));
      } else if (splitMethod === 'percentage') {
        const percMap: Record<string, number> = {};
        let hasNegativePerc = false;

        selectedParticipants.forEach((userId) => {
          const valPerc = parseFloat(percentagesStr[userId] || '0');
          if (valPerc < 0) hasNegativePerc = true;
          percMap[userId] = valPerc;
        });

        if (hasNegativePerc) {
          setErrorMessage('Percentage shares cannot be negative.');
          setIsSubmitting(false);
          return;
        }

        const percResult = calculatePercentageSplits(totalCents, percMap);
        if (!percResult.is100Percent) {
          setErrorMessage('Percentages must total 100%.');
          setIsSubmitting(false);
          return;
        }

        finalShares = selectedParticipants.map((userId) => ({
          userId,
          amountCents: percResult.shares[userId] || 0,
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
          cardId: paymentType === 'card' ? (selectedCardId || cards[0]?.id) : undefined,
        },
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        receiptUrl: receiptUrl || undefined,
        notes: notes.trim() || undefined,
      },
      initialExpense ? initialExpense.id : undefined
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="modal-title">
                {initialExpense ? 'Edit Expense Record' : getTranslation('newExpense', lang)}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Log shared household purchases or private personal outlays
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Scope Selector: Shared Household vs Private Personal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <button
            type="button"
            className={`btn ${scope === 'household' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
            onClick={() => setScope('household')}
          >
            <Users size={18} />
            <span>Shared Household Expense</span>
          </button>

          <button
            type="button"
            className={`btn ${scope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
            onClick={() => {
              setScope('personal');
              setSelectedParticipants([paidBy || activeUserId]);
              setSplitMethod('equal');
            }}
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

          {/* Payment Method Selector: Cash vs Card */}
          <div className="form-group">
            <label className="form-label">Payment Channel</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${paymentType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setPaymentType('cash')}
              >
                <Banknote size={16} />
                <span>{getTranslation('cash', lang)}</span>
              </button>

              <button
                type="button"
                className={`btn ${paymentType === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setPaymentType('card')}
              >
                <CreditCard size={16} />
                <span>{getTranslation('bankCard', lang)}</span>
              </button>
            </div>

            {paymentType === 'card' && cards.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <select
                  className="form-select"
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      💳 {c.bankName} ({c.cardType === 'debit' ? 'Debit' : 'Credit'})
                    </option>
                  ))}
                </select>
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
                    {isScanningOcr ? getTranslation('scanReceipt', lang) : getTranslation('ocrSuccess', lang)}
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

          {/* Household Scope Split Options (Locked when Personal Scope) */}
          {scope === 'household' && (
            <>
              <div className="form-group">
                <label className="form-label">Split Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitMethod('equal')}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitMethod('custom')}
                  >
                    Custom Exact ৳
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitMethod === 'percentage' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitMethod('percentage')}
                  >
                    Percentage %
                  </button>
                </div>
              </div>

              {/* Participant Selection */}
              <div className="form-group">
                <label className="form-label">Split Among Housemates</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {houseUsers.map((user) => {
                    const isSelected = selectedParticipants.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-input)',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleParticipant(user.id)}
                          />
                          <UserAvatar user={user} size={24} />
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</span>
                        </div>

                        {isSelected && splitMethod === 'custom' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>৳</span>
                            <input
                              type="number"
                              step="0.01"
                              style={{ width: '80px', padding: '4px 6px', fontSize: '0.85rem' }}
                              className="form-input tabular-nums"
                              placeholder="0.00"
                              value={customSharesStr[user.id] || ''}
                              onChange={(e) =>
                                setCustomSharesStr({ ...customSharesStr, [user.id]: e.target.value })
                              }
                            />
                          </div>
                        )}

                        {isSelected && splitMethod === 'percentage' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              step="0.1"
                              style={{ width: '70px', padding: '4px 6px', fontSize: '0.85rem' }}
                              className="form-input tabular-nums"
                              placeholder="0"
                              value={percentagesStr[user.id] || ''}
                              onChange={(e) =>
                                setPercentagesStr({ ...percentagesStr, [user.id]: e.target.value })
                              }
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Automated Recurring Bill Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Automated Recurring Expense</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically generate this bill every week or month</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isRecurring && (
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as RecurringFrequency)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              )}
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Check size={18} />
              <span>{isSubmitting ? 'Saving...' : initialExpense ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
