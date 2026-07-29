import React, { useState, useMemo } from 'react';
import type { Expense, Settlement, SimplifiedTransaction, User as UserType } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers, USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ArrowRight, CheckCircle2, History, Check, ArrowLeftRight } from 'lucide-react';

interface SettlementViewProps {
  expenses: Expense[];
  settlements: Settlement[];
  onMarkSettled: (transaction: SimplifiedTransaction) => void;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  expenses,
  settlements,
  onMarkSettled,
}) => {
  const { currentHouse } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse), [currentHouse]);

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const userBalances = useMemo(
    () => calculateNetBalances(expenses, settlements, houseUsers),
    [expenses, settlements, houseUsers]
  );

  const simplifiedTransactions = useMemo(
    () => calculateSimplifiedSettlements(userBalances, houseUsers),
    [userBalances, houseUsers]
  );

  const completedSettlements = [...settlements]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());

  const getUser = (userId: string): UserType => {
    const found = houseUsers.find((u) => u.id === userId || u.name.toLowerCase() === userId.toLowerCase());
    if (found) return found;
    return USERS[userId] || { id: userId, name: userId, avatar: userId, color: '#3b82f6' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Household Settlement Hub</h1>
          <p className="page-description">
            Automated cash-flow minimizer computes optimal peer-to-peer transfers to balance all debts
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
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
          <span>Settlement Audit Log ({completedSettlements.length})</span>
        </button>
      </div>

      {/* TAB 1: PENDING MIN-CASH-FLOW RECOMMENDATIONS */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {simplifiedTransactions.length === 0 ? (
            <div className="glass-card empty-state">
              <CheckCircle2 className="empty-icon" style={{ color: 'var(--accent-emerald)' }} />
              <div className="empty-title">All Household Debts Fully Settled!</div>
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
                      {formatCurrency(tx.amountCents)}
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
                      <div className="flow-amount tabular-nums">{formatCurrency(tx.amountCents)}</div>
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
                    <button className="btn btn-success" onClick={() => onMarkSettled(tx)}>
                      <Check size={18} />
                      <span>Confirm & Mark as Settled</span>
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
          {completedSettlements.length === 0 ? (
            <div className="glass-card empty-state">
              <History className="empty-icon" />
              <div className="empty-title">No completed settlement audit records</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                When payments are completed and confirmed, they will be archived safely here.
              </p>
            </div>
          ) : (
            <div>
              {completedSettlements.map((st) => {
                const fromUser = getUser(st.fromUserId);
                const toUser = getUser(st.toUserId);
                const settledDate = new Date(st.settledAt).toLocaleDateString('en-US', {
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
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '18px 22px',
                      marginBottom: '10px',
                      gap: '16px',
                    }}
                  >
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
                          Confirmed on {settledDate} • Status: <span style={{ color: 'var(--status-positive-text)', fontWeight: 700 }}>Settled</span>
                        </div>
                      </div>
                    </div>

                    <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-positive-text)' }}>
                      {formatCurrency(st.amountCents)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
