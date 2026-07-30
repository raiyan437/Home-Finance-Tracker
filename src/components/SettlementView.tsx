import React, { useState, useMemo } from 'react';
import type { Expense, Settlement, SimplifiedTransaction, User as UserType } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers, USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { ArrowRight, CheckCircle2, History, Check, ArrowLeftRight, RotateCcw, Image as ImageIcon, X, Trash2 } from 'lucide-react';

interface SettlementViewProps {
  expenses: Expense[];
  settlements: Settlement[];
  onMarkSettled: (transaction: SimplifiedTransaction) => void;
  onReverseSettlement?: (settlementId: string) => void;
  onClearSettlements?: () => void;
  lang?: Language;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  expenses,
  settlements,
  onMarkSettled,
  onReverseSettlement,
  onClearSettlements,
  lang = 'en',
}) => {
  const { currentHouse, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [confirmingTx, setConfirmingTx] = useState<SimplifiedTransaction | null>(null);
  const [proofUrl, setProofUrl] = useState<string>('');

  const userBalances = useMemo(
    () => calculateNetBalances(expenses, settlements, houseUsers),
    [expenses, settlements, houseUsers]
  );

  const simplifiedTransactions = useMemo(
    () => calculateSimplifiedSettlements(userBalances, houseUsers),
    [userBalances, houseUsers]
  );

  const allSettlements = [...settlements].sort(
    (a, b) => new Date(b.settledAt || b.createdAt).getTime() - new Date(a.settledAt || a.createdAt).getTime()
  );

  const getUser = (userId: string): UserType => {
    const found = houseUsers.find((u) => u.id === userId || u.name.toLowerCase() === userId.toLowerCase());
    if (found) return found;
    return USERS[userId] || { id: userId, name: userId, avatar: userId, color: '#3b82f6' };
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProofUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{getTranslation('settlements', lang)}</h1>
          <p className="page-description">
            Automated cash-flow minimizer computes optimal peer-to-peer transfers to balance all debts
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pending')}
          >
            <ArrowLeftRight size={16} />
            <span>Active Recommendations ({simplifiedTransactions.length})</span>
          </button>

          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>Settlement Audit Log ({allSettlements.length})</span>
          </button>
        </div>

        {onClearSettlements && (allSettlements.length > 0 || simplifiedTransactions.length > 0) && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            onClick={onClearSettlements}
            title="Clear all recommendations and audit logs"
          >
            <Trash2 size={14} />
            <span>Clear Audit Data</span>
          </button>
        )}
      </div>

      {/* TAB 1: PENDING MIN-CASH-FLOW RECOMMENDATIONS */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {simplifiedTransactions.length === 0 ? (
            <div className="glass-card empty-state">
              <CheckCircle2 className="empty-icon" style={{ color: 'var(--accent-emerald)' }} />
              <div className="empty-title">{getTranslation('allDebtsSettled', lang)}</div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Every housemate has a ৳0.00 net balance position. No peer-to-peer transfers required.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {simplifiedTransactions.map((tx) => (
                <div key={tx.id} className="settlement-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-negative">Debt Payment Pending</span>
                    <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                      {formatCurrency(tx.amountCents, false, lang)}
                    </span>
                  </div>

                  <div className="settlement-flow">
                    <div className="flow-user">
                      <UserAvatar user={tx.fromUser} size={48} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{tx.fromUser.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-rose)', fontWeight: 700 }}>
                          Payer (Owes Money)
                        </div>
                      </div>
                    </div>

                    <div className="flow-arrow">
                      <ArrowRight size={28} className="flow-arrow-icon" style={{ color: 'var(--accent-amber)' }} />
                      <div className="flow-amount tabular-nums">{formatCurrency(tx.amountCents, false, lang)}</div>
                    </div>

                    <div className="flow-user">
                      <UserAvatar user={tx.toUser} size={48} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{tx.toUser.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                          Receiver (Gets Paid)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
                    <button
                      className="btn btn-success"
                      onClick={() => {
                        setProofUrl('');
                        setConfirmingTx(tx);
                      }}
                    >
                      <Check size={18} />
                      <span>{getTranslation('markAsPaid', lang)}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SETTLEMENT AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {allSettlements.length === 0 ? (
            <div className="glass-card empty-state">
              <History className="empty-icon" />
              <div className="empty-title">No completed settlement audit records</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                When payments are completed and confirmed, they will be archived safely here.
              </p>
            </div>
          ) : (
            <div>
              {allSettlements.map((st) => {
                const fromUser = getUser(st.fromUserId);
                const toUser = getUser(st.toUserId);
                const isReversed = st.status === 'reversed';

                const settledDate = new Date(st.settledAt || st.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={st.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '18px 22px',
                      marginBottom: '10px',
                      opacity: isReversed ? 0.65 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <UserAvatar user={fromUser} size={36} />
                          <UserAvatar user={toUser} size={36} style={{ marginLeft: '-10px' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                            {fromUser.name} paid {toUser.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Confirmed on {settledDate} • Status:{' '}
                            <span
                              style={{
                                color: isReversed ? 'var(--accent-rose)' : 'var(--status-positive-text)',
                                fontWeight: 700,
                              }}
                            >
                              {isReversed ? getTranslation('reversedStatus', lang) : getTranslation('settledStatus', lang)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: isReversed ? 'var(--text-muted)' : 'var(--status-positive-text)',
                            textDecoration: isReversed ? 'line-through' : 'none',
                          }}
                        >
                          {formatCurrency(st.amountCents, false, lang)}
                        </div>

                        {!isReversed && onReverseSettlement && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)' }}
                            onClick={() => onReverseSettlement(st.id)}
                            title="Reverse settlement"
                          >
                            <RotateCcw size={14} />
                            <span>{getTranslation('reverseSettlement', lang)}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Proof of Payment Image Preview */}
                    {st.proofUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                        <ImageIcon size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {getTranslation('proofAttached', lang)}:
                        </span>
                        <a href={st.proofUrl} target="_blank" rel="noreferrer">
                          <img
                            src={st.proofUrl}
                            alt="Payment Proof"
                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-medium)' }}
                          />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Debt Settlement Modal with Proof Upload */}
      {confirmingTx && (
        <div className="modal-overlay" onClick={() => setConfirmingTx(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Debt Settlement</h3>
              <button className="close-btn" onClick={() => setConfirmingTx(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', margin: '10px 0' }}>
              Confirm that <strong>{confirmingTx.fromUser.name}</strong> paid <strong>{confirmingTx.toUser.name}</strong>{' '}
              <strong style={{ color: 'var(--accent-amber)' }}>{formatCurrency(confirmingTx.amountCents, false, lang)}</strong>?
            </p>

            {/* Proof of Payment Upload */}
            <div className="form-group" style={{ margin: '14px 0' }}>
              <label className="form-label">{getTranslation('uploadProof', lang)} (bKash / Nagad / Bank Slip)</label>
              {proofUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <img src={proofUrl} alt="Proof" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', flex: 1 }}>✓ Proof uploaded</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setProofUrl('')}>
                    Remove
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-medium)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <ImageIcon size={16} />
                  <span>Attach bKash/Nagad/Bank Slip Screenshot</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProofUpload} />
                </label>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmingTx(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onMarkSettled(confirmingTx);
                  setConfirmingTx(null);
                }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
