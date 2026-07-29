import React from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, ALL_USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { CategoryChart } from './CategoryChart';
import { UserAvatar } from './UserAvatar';
import { TrendingUp, ArrowRight, CheckCircle2, Receipt, Wallet, Activity } from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  settlements: Settlement[];
  onNavigateToSettlement: () => void;
  onNavigateToExpenses: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  expenses,
  settlements,
  onNavigateToSettlement,
  onNavigateToExpenses,
}) => {
  const userBalances = calculateNetBalances(expenses, settlements);
  const simplifiedSettlements = calculateSimplifiedSettlements(userBalances);

  const totalSpentCents = expenses.reduce((sum, exp) => sum + exp.amountCents, 0);

  // Calculate total pending debt in household
  const totalPendingDebtCents = simplifiedSettlements.reduce((sum, st) => sum + st.amountCents, 0);

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Household Dashboard</h1>
          <p className="page-description">
            Real-time expense tracking & automated debt settlement engine for Raiyan, Himel & Lazim
          </p>
        </div>
      </div>

      {/* Grid of 4 Hero Summary Stat Cards */}
      <div className="grid-summary">
        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Total Household Spend</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="summary-amount tabular-nums">{formatCurrency(totalSpentCents)}</div>
          <div className="summary-footer">
            <Activity size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>{expenses.length} active transactions</span>
          </div>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Outstanding Debt</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Wallet size={20} />
            </div>
          </div>
          <div className="summary-amount tabular-nums" style={{ color: totalPendingDebtCents > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
            {formatCurrency(totalPendingDebtCents)}
          </div>
          <div className="summary-footer">
            <span>{simplifiedSettlements.length} transfer{simplifiedSettlements.length === 1 ? '' : 's'} required</span>
          </div>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Settled Debt Paid</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="summary-amount tabular-nums" style={{ color: 'var(--accent-emerald)' }}>
            {formatCurrency(settlements.reduce((sum, st) => sum + st.amountCents, 0))}
          </div>
          <div className="summary-footer">
            <span>{settlements.length} settlement records</span>
          </div>
        </div>

        <div className="glass-card summary-card">
          <div className="summary-card-header">
            <span className="summary-title">Average Per Member</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <Activity size={20} />
            </div>
          </div>
          <div className="summary-amount tabular-nums">
            {formatCurrency(Math.round(totalSpentCents / 3))}
          </div>
          <div className="summary-footer">
            <span>Split evenly across 3 members</span>
          </div>
        </div>
      </div>

      {/* Housemate Net Balances Grid */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>
          Housemate Net Balances
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {ALL_USERS.map((user) => {
            const netCents = userBalances[user.id]?.netBalanceCents || 0;
            const isCreditor = netCents > 0;
            const isDebtor = netCents < 0;
            const paidCents = expenses
              .filter((e) => e.paidBy === user.id)
              .reduce((sum, e) => sum + e.amountCents, 0);

            return (
              <div key={user.id} className="glass-card balance-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UserAvatar user={user} size={44} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{user.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Paid {formatCurrency(paidCents)} out-of-pocket
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Net Position
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 900,
                      color: isCreditor
                        ? 'var(--accent-emerald)'
                        : isDebtor
                        ? 'var(--accent-rose)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {isCreditor ? `+${formatCurrency(netCents)}` : formatCurrency(netCents)}
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>
                    {isCreditor && <span style={{ color: 'var(--accent-emerald)' }}>Gets back overall</span>}
                    {isDebtor && <span style={{ color: 'var(--accent-rose)' }}>Owes overall</span>}
                    {!isCreditor && !isDebtor && <span style={{ color: 'var(--text-muted)' }}>Fully settled</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics Chart Component */}
      <CategoryChart expenses={expenses} />

      {/* Suggested Settlements Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Optimized Direct Transfers
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Greedy minimum cash-flow algorithm reduces total transactions
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToSettlement}>
            <span>View All Settlements</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {simplifiedSettlements.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '32px', color: 'var(--accent-emerald)' }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>All Household Accounts Settled!</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              No outstanding debts remain between Raiyan, Himel, or Lazim.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {simplifiedSettlements.map((st, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <UserAvatar user={st.fromUser} size={38} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{st.fromUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Debtor</div>
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, padding: '0 6px' }}>pays</span>

                  <UserAvatar user={st.toUser} size={38} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{st.toUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Creditor</div>
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Recent Household Expenses</h2>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToExpenses}>
            <span>View All ({expenses.length})</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="empty-state glass-card">
            <Receipt className="empty-icon" />
            <div className="empty-title">No expenses recorded yet</div>
            <p style={{ fontSize: '0.85rem' }}>No household expenses logged for this period.</p>
          </div>
        ) : (
          <div>
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
