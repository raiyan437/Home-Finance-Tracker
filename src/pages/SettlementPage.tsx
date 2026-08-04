import React, { useState, useMemo } from 'react';
import type { Expense, Settlement, SimplifiedTransaction, User as UserType } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers, USERS } from '../features/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { shareSettlementInstructions } from '../utils/share';
import { saveAttachment } from '../services/attachments';
import { ArrowRight, CheckCircle2, History, Check, ArrowLeftRight, RotateCcw, Image as ImageIcon, X, Share2, Paperclip } from 'lucide-react';
import { getSettlementMonthKey } from '../features/monthlyDashboard';

interface SettlementViewProps {
  expenses: Expense[];
  settlements: Settlement[];
  onMarkSettled: (transaction: SimplifiedTransaction, proofUrl?: string) => void | Promise<void>;
  onReverseSettlement?: (settlementId: string) => void;
  lang?: Language;
}

export const SettlementPage: React.FC<SettlementViewProps> = ({
  expenses,
  settlements,
  onMarkSettled,
  onReverseSettlement,
  lang = 'en',
}) => {
  const { currentHouse, dbUserProfile, activeUserId } = useAuth();
  const myUid = dbUserProfile?.uid || activeUserId;
  const isLeader = Boolean(
    dbUserProfile?.role === 'leader' ||
    (currentHouse && currentHouse.leaderUid && (currentHouse.leaderUid === dbUserProfile?.uid || currentHouse.leaderUid === activeUserId))
  );
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const isRecipientUser = (tx: SimplifiedTransaction): boolean => {
    if (!myUid) return false;
    const cleanMyUid = myUid.toLowerCase().trim();
    const toUser = tx.toUser;
    return Boolean(
      (toUser.id && toUser.id.toLowerCase().trim() === cleanMyUid) ||
      (toUser.uid && toUser.uid.toLowerCase().trim() === cleanMyUid)
    );
  };

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [confirmingTx, setConfirmingTx] = useState<SimplifiedTransaction | null>(null);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isConfirmingSettlement, setIsConfirmingSettlement] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<'all' | 'completed' | 'reversed'>('all');
  const [historyMonth, setHistoryMonth] = useState('all');

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
  const historyMonths = useMemo(
    () => Array.from(new Set(allSettlements.map(getSettlementMonthKey).filter((month): month is string => Boolean(month)))).sort().reverse(),
    [allSettlements]
  );
  const visibleSettlements = allSettlements.filter((settlement) => (
    (historyStatus === 'all' || settlement.status === historyStatus)
      && (historyMonth === 'all' || getSettlementMonthKey(settlement) === historyMonth)
  ));

  const getUser = (userId: string): UserType => {
    const found = houseUsers.find((u) => u.id === userId || u.uid === userId);
    if (found) return found;
    return USERS[userId] || { id: userId, name: userId, avatar: userId, color: '#6750a4' };
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        setShareFeedback('Proof must be an image no larger than 5 MB.');
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setProofUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShareTx = async (tx: SimplifiedTransaction) => {
    const amountStr = formatCurrency(tx.amountCents, false, lang);
    const res = await shareSettlementInstructions(tx.fromUser.name, tx.toUser.name, amountStr);
    if (res.success) {
      setShareFeedback(res.method === 'share' ? 'Shared payment notice!' : 'Instructions copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 2500);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
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

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Completed payments are immutable audit records. Use the history filters to hide older entries.
        </span>
      </div>

      {shareFeedback && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-emerald)', padding: '12px 18px', fontSize: '0.85rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
          ✓ {shareFeedback}
        </div>
      )}

      {/* TAB 1: PENDING MIN-CASH-FLOW RECOMMENDATIONS */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {simplifiedTransactions.length === 0 ? (
            <div className="glass-card empty-state">
              <CheckCircle2 className="empty-icon" style={{ color: 'var(--accent-emerald)' }} />
              <h3>All Debts Fully Settled!</h3>
              <p>Minimum cash flow engine reports zero pending transfers needed between active housemates.</p>
            </div>
          ) : (
            simplifiedTransactions.map((tx) => (
              <div key={tx.id} className="glass-card transaction-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  {/* From User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <UserAvatar user={tx.fromUser} size={48} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{tx.fromUser.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)' }}>Payer (Owes balance)</div>
                    </div>
                  </div>

                  {/* Transfer Direction */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-amber)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pays</span>
                      <ArrowRight size={20} />
                    </div>
                    <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                      {formatCurrency(tx.amountCents, false, lang)}
                    </div>
                  </div>

                  {/* To User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{tx.toUser.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>Recipient (Receives debt)</div>
                    </div>
                    <UserAvatar user={tx.toUser} size={48} />
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleShareTx(tx)}
                    title="Share transfer instructions via WhatsApp/SMS"
                  >
                    <Share2 size={14} />
                    <span>Share App</span>
                  </button>

                  {isRecipientUser(tx) ? (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        setProofUrl('');
                        setConfirmingTx(tx);
                      }}
                      title="Confirm receipt of debt payment"
                    >
                      <Check size={16} />
                      <span>{getTranslation('markAsPaid', lang)}</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontWeight: 600,
                      }}
                    >
                      <span>{getTranslation('onlyRecipientCanMarkPaid', lang)} ({tx.toUser.name})</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: SETTLEMENT AUDIT LOG */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Status
              <select className="form-input" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as typeof historyStatus)} style={{ marginLeft: '6px', width: 'auto' }}>
                <option value="all">All records</option>
                <option value="completed">Completed</option>
                <option value="reversed">Reversed</option>
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Completion month
              <select className="form-input" value={historyMonth} onChange={(event) => setHistoryMonth(event.target.value)} style={{ marginLeft: '6px', width: 'auto' }}>
                <option value="all">All months</option>
                {historyMonths.map((month) => <option key={month} value={month}>{month}</option>)}
              </select>
            </label>
          </div>
          {visibleSettlements.length === 0 ? (
            <div className="glass-card empty-state">
              <History className="empty-icon" />
              <h3>{getTranslation('noSettlementsYet', lang)}</h3>
              <p>Completed debt settlements and proof-of-payment logs will appear here.</p>
            </div>
          ) : (
            <div>
              {visibleSettlements.map((st) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
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

                        {st.proofUrl && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPreviewProofUrl(st.proofUrl || null)}
                            title="View Payment Proof Screenshot"
                          >
                            <Paperclip size={14} style={{ color: 'var(--accent-primary)' }} />
                            <span>[Attached Proof 📎]</span>
                          </button>
                        )}

                        {!isReversed && onReverseSettlement && (() => {
                          const canReverse =
                            isLeader ||
                            st.toUserId === myUid ||
                            (houseUsers.find((u) => u.id === st.toUserId)?.uid === myUid);
                          return canReverse ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)' }}
                              onClick={() => onReverseSettlement(st.id)}
                              title="Reverse settlement"
                            >
                              <RotateCcw size={14} />
                              <span>{getTranslation('reverseSettlement', lang)}</span>
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </div>
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', flex: 1 }}>✓ Proof attached</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => { setProofUrl(''); setProofFile(null); }}>
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
                onClick={async () => {
                  try {
                    setIsConfirmingSettlement(true);
                    const persistedProof = proofFile ? await saveAttachment(proofFile, 'settlement-proofs', currentHouse?.id) : (proofUrl || undefined);
                    await onMarkSettled(confirmingTx, persistedProof);
                    setConfirmingTx(null);
                    setProofFile(null);
                    setProofUrl('');
                  } catch (error) {
                    setShareFeedback(error instanceof Error ? error.message : 'Unable to upload payment proof.');
                  } finally {
                    setIsConfirmingSettlement(false);
                  }
                }}
                disabled={isConfirmingSettlement}
              >
                {isConfirmingSettlement ? 'Confirming…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Photo Preview Modal for Attached Payment Proof */}
      {previewProofUrl && (
        <div className="modal-overlay" onClick={() => setPreviewProofUrl(null)}>
          <div className="modal-card" style={{ maxWidth: '520px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Payment Proof Screenshot</h3>
              <button className="close-btn" onClick={() => setPreviewProofUrl(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 0' }}>
              <img
                src={previewProofUrl}
                alt="Full Payment Proof"
                style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={() => setPreviewProofUrl(null)} style={{ margin: '0 auto' }}>
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
