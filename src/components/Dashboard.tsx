import React from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, ALL_USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { CategoryChart } from './CategoryChart';
import { UserAvatar } from './UserAvatar';
import { TrendingUp, ArrowRight, CheckCircle2, RotateCcw, Plus, Receipt, DollarSign, Wallet, CreditCard } from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  settlements: Settlement[];
  onOpenAddExpense: () => void;
  onNavigateToSettlement: () => void;
  onNavigateToExpenses: () => void;
  onResetData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  expenses,
  settlements,
  onOpenAddExpense,
  onNavigateToSettlement,
  onNavigateToExpenses,
  onResetData,
}) => {
  const userBalances = calculateNetBalances(expenses, settlements);
  const simplifiedSettlements = calculateSimplifiedSettlements(userBalances);

  const totalSpentCents = expenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  const totalSettledCents = settlements.reduce((sum, st) => sum + st.amountCents, 0);
  
  // Calculate total pending debt in household
  const totalPendingDebtCents = simplifiedSettlements.reduce((sum, st) => sum + st.amountCents, 0);

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner & Quick Add */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Household Dashboard</h1>
          <p className="page-description">
            Real-time expense tracking & automated debt settlement engine for Raiyan, Himel & Lazim
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={onResetData} title="Reset to initial test scenarios A-E">
            <RotateCcw size={15} />
            <span>Reset Demo Data</span>
          </button>
          <button className="btn btn-primary" onClick={onOpenAddExpense}>
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Grid of 4 Hero Metric Cards */}
      <div className="grid-4">
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Household Spend</span>
            <div className="metric-icon-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="metric-value tabular-nums">{formatCurrency(totalSpentCents)}</div>
          <div className="metric-footer">
            <span className="trend-badge positive">+4.8%</span>
            <span>{expenses.length} active transactions</span>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Outstanding Debt</span>
            <div className="metric-icon-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Wallet size={20} />
            </div>
          </div>
          <div className="metric-value tabular-nums" style={{ color: totalPendingDebtCents > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
            {formatCurrency(totalPendingDebtCents)}
          </div>
          <div className="metric-footer">
            <span className="trend-badge negative">{simplifiedSettlements.length} transfers</span>
            <span>pending simplification</span>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Settled Debt Paid</span>
            <div className="metric-icon-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="metric-value tabular-nums" style={{ color: 'var(--accent-emerald)' }}>
            {formatCurrency(totalSettledCents)}
          </div>
          <div className="metric-footer">
            <span className="trend-badge positive">Cleared</span>
            <span>{settlements.length} completed settlements</span>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Average / Member</span>
            <div className="metric-icon-badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="metric-value tabular-nums">
            {formatCurrency(Math.round(totalSpentCents / ALL_USERS.length))}
          </div>
          <div className="metric-footer">
            <span>Equal 3-way split ratio</span>
          </div>
        </div>
      </div>

      {/* 3 Housemates Net Position Cards Grid */}
      <div>
        <div className="housemates-section-title">
          <CreditCard size={20} style={{ color: 'var(--accent-primary)' }} />
          <span>Housemate Balance Cards</span>
        </div>
        <div className="grid-3">
          {ALL_USERS.map((user) => {
            const b = userBalances[user.id];
            const net = b.netBalanceCents;

            let badgeText = 'Balanced';
            let statusPrefix = 'Settled';

            if (net > 0) {
              badgeText = 'Gets Back';
              statusPrefix = 'To receive';
            } else if (net < 0) {
              badgeText = 'Owes';
              statusPrefix = 'Needs to pay';
            }

            // Calculate paid vs fair share ratio
            const fairShareCents = Math.round(totalSpentCents / ALL_USERS.length);
            const paidRatioPercent = fairShareCents > 0 ? Math.min(100, Math.max(0, (b.totalPaidCents / fairShareCents) * 100)) : 0;

            return (
              <div key={user.id} className="glass-card user-balance-card interactive">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="user-card-header">
                    <UserAvatar user={user} size={48} />
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-role-tag">Household Partner</div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      backgroundColor: net > 0 ? 'var(--status-positive-bg)' : net < 0 ? 'var(--status-negative-bg)' : 'var(--status-settled-bg)',
                      color: net > 0 ? 'var(--status-positive-text)' : net < 0 ? 'var(--status-negative-text)' : 'var(--status-settled-text)',
                      border: `1px solid ${net > 0 ? 'var(--status-positive-border)' : net < 0 ? 'var(--status-negative-border)' : 'var(--status-settled-border)'}`,
                    }}
                  >
                    {badgeText}
                  </span>
                </div>

                <div className={`balance-status-box ${net > 0 ? 'positive' : net < 0 ? 'negative' : 'settled'}`}>
                  <span className="balance-label">{statusPrefix}</span>
                  <div
                    className="balance-amount tabular-nums"
                    style={{
                      color: net > 0 ? 'var(--status-positive-text)' : net < 0 ? 'var(--status-negative-text)' : 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(net, true)}
                  </div>
                </div>

                {/* Paid ratio bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                    <span>Out-of-pocket Target Share</span>
                    <span>{paidRatioPercent.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${paidRatioPercent}%`,
                        backgroundColor: user.color,
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Out-of-pocket</div>
                    <div className="tabular-nums" style={{ fontSize: '0.95rem', fontWeight: 800 }}>{formatCurrency(b.totalPaidCents)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Fair Share</div>
                    <div className="tabular-nums" style={{ fontSize: '0.95rem', fontWeight: 800 }}>{formatCurrency(b.totalShareCents)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spend Analytics & Category Breakdown */}
      <CategoryChart expenses={expenses} />

      {/* Simplified Debt Transfer Action Box */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Optimal Debt Settlement Plan</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Min-cash-flow algorithm computes minimum direct transfers to clear all debts
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToSettlement}>
            <span>Full Settlement Log</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {simplifiedSettlements.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--status-positive-text)', backgroundColor: 'var(--status-positive-bg)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--status-positive-border)' }}>
            <CheckCircle2 size={22} />
            <div>
              <div style={{ fontWeight: 800 }}>Household Fully Balanced!</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>No outstanding debts or transfers required between Raiyan, Himel, and Lazim.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {simplifiedSettlements.map((st) => (
              <div
                key={st.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <UserAvatar user={st.fromUser} size={38} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{st.fromUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payer (Debtor)</div>
                  </div>

                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 800, padding: '0 6px' }}>➜ pays</span>

                  <UserAvatar user={st.toUser} size={38} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{st.toUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recipient (Creditor)</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                    {formatCurrency(st.amountCents)}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={onNavigateToSettlement}>
                    <span>Settle Now</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Stream */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Recent Household Expenses</h2>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToExpenses}>
            <span>View All ({expenses.length})</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <Receipt style={{ width: '40px', height: '40px', color: 'var(--text-muted)', marginBottom: '12px' }} />
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>No expenses recorded yet</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>Click below to add your first expense split.</p>
            <button className="btn btn-primary" onClick={onOpenAddExpense}>
              <Plus size={16} /> Add First Expense
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentExpenses.map((exp) => {
              const payer = ALL_USERS.find((u) => u.id === exp.paidBy) || ALL_USERS[0];
              return (
                <div key={exp.id} className="expense-item-card">
                  <div className="expense-left">
                    <UserAvatar user={payer} size={42} />
                    <div className="expense-info-group">
                      <div className="expense-title-row">
                        <span className="expense-title">{exp.title}</span>
                        <span className={`cat-pill cat-${exp.category}`}>{exp.category}</span>
                      </div>
                      <div className="expense-meta-row">
                        <span>Paid by <strong>{payer.name}</strong></span>
                        <span>•</span>
                        <span>{exp.date}</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{exp.splitMethod} Split</span>
                      </div>
                    </div>
                  </div>

                  <div className="expense-right">
                    <div className="expense-amount-display tabular-nums">{formatCurrency(exp.amountCents)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
