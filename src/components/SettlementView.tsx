import React, { useState } from 'react';
import type { Expense, Settlement, SimplifiedTransaction } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { ArrowRight, CheckCircle2, History, Check, ShieldCheck, ArrowLeftRight } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const userBalances = calculateNetBalances(expenses, settlements);
  const simplifiedTransactions = calculateSimplifiedSettlements(userBalances);

  const completedSettlements = [...settlements]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());

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
          <span>Settlement Audit History ({completedSettlements.length})</span>
        </button>
      </div>

      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Explanation Header */}
          {simplifiedTransactions.length > 0 ? (
            <div
              className="glass-card"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <ShieldCheck size={32} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Optimal Debt Simplification Calculated</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Instead of complex multiple payments, completing these <strong>{simplifiedTransactions.length} transfer(s)</strong> will clear all household debts completely.
                </p>
              </div>
            </div>
          ) : null}

          {/* List of recommended transfers */}
          {simplifiedTransactions.length === 0 ? (
            <div className="glass-card empty-state">
              <CheckCircle2 size={56} style={{ color: 'var(--status-positive-text)' }} />
              <div className="empty-title">All House Debts Fully Settled!</div>
              <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '0.88rem' }}>
                Every housemate has a balanced net ledger of $0.00. No further payments or transfers are required.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {simplifiedTransactions.map((tx) => (
                <div key={tx.id} className="settlement-card">
                  <div className="settlement-flow">
                    {/* Debtor */}
                    <div className="flow-user">
                      <UserAvatar user={tx.fromUser} size={54} />
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{tx.fromUser.name}</div>
                      <span className="badge badge-negative">Debtor (Owes)</span>
                    </div>

                    {/* Transfer Amount Arrow */}
                    <div className="flow-arrow">
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        DIRECT TRANSFER
                      </span>
                      <div className="flow-amount tabular-nums">{formatCurrency(tx.amountCents)}</div>
                      <ArrowRight size={26} style={{ color: 'var(--accent-amber)' }} />
                    </div>

                    {/* Creditor */}
                    <div className="flow-user">
                      <UserAvatar user={tx.toUser} size={54} />
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{tx.toUser.name}</div>
                      <span className="badge badge-positive">Creditor (Receives)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      After this payment, {tx.fromUser.name}'s balance with {tx.toUser.name} will be resolved.
                    </span>

                    <button
                      className="btn btn-success"
                      onClick={() => onMarkSettled(tx)}
                    >
                      <Check size={17} />
                      <span>Confirm & Mark Paid</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                const fromUser = USERS[st.fromUserId];
                const toUser = USERS[st.toUserId];
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '-6px' }}>
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
