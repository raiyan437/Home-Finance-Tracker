import React, { useMemo } from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
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
  const { currentHouse, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const userBalances = useMemo(
    () => calculateNetBalances(expenses, settlements, houseUsers),
    [expenses, settlements, houseUsers]
  );

  const simplifiedSettlements = useMemo(
    () => calculateSimplifiedSettlements(userBalances, houseUsers),
    [userBalances, houseUsers]
  );

  const totalSpentCents = expenses.reduce((sum, exp) => sum + exp.amountCents, 0);

  // Calculate total pending debt in household
  const totalPendingDebtCents = simplifiedSettlements.reduce((sum, st) => sum + st.amountCents, 0);

  const memberCount = Math.max(1, houseUsers.length);
  const averagePerMemberCents = Math.round(totalSpentCents / memberCount);

  const memberNamesText = houseUsers.map((u) => u.name).join(', ');

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{currentHouse ? currentHouse.name : 'Household Dashboard'}</h1>
          <p className="page-description">
            Real-time expense tracking & automated debt settlement engine for {memberNamesText}
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
            {formatCurrency(averagePerMemberCents)}
          </div>
          <div className="summary-footer">
            <span>Split evenly across {memberCount} member{memberCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Housemate Net Balances Grid */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>
          Housemate Net Balances ({houseUsers.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {houseUsers.map((user) => {
            const netCents = userBalances[user.id]?.netBalanceCents || 0;
            const isCreditor = netCents > 0;
            const isDebtor = netCents < 0;
            const paidCents = expenses
              .filter((e) => e.paidBy === user.id || e.paidBy.toLowerCase() === user.name.toLowerCase())
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

      {/* Middle Section: Direct Debt Settlement Action Cards */}
      {simplifiedSettlements.length > 0 && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Optimized Debt Settlement Payments ({simplifiedSettlements.length})
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Minimum cash flow algorithm solved to eliminate redundant transactions
              </p>
            </div>

            <button className="btn btn-primary btn-sm" onClick={onNavigateToSettlement}>
              <span>Settlement Hub</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {simplifiedSettlements.map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserAvatar user={tx.fromUser} size={36} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{tx.fromUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)' }}>Owes debt</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <ArrowRight size={18} style={{ color: 'var(--accent-amber)' }} />
                  <span className="tabular-nums" style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--accent-amber)' }}>
                    {formatCurrency(tx.amountCents)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', textAlign: 'right' }}>{tx.toUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', textAlign: 'right' }}>Receives payment</div>
                  </div>
                  <UserAvatar user={tx.toUser} size={36} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics & Recent Transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        <CategoryChart expenses={expenses} />

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Recent Shared Expenses
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={onNavigateToExpenses}>
              <span>View All</span>
              <Receipt size={16} />
            </button>
          </div>

          {recentExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              No expenses recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentExpenses.map((exp) => {
                const payer = houseUsers.find((u) => u.id === exp.paidBy || u.name.toLowerCase() === exp.paidBy.toLowerCase()) || {
                  id: exp.paidBy,
                  name: exp.paidBy,
                  avatar: exp.paidBy,
                  color: '#3b82f6',
                };

                return (
                  <div
                    key={exp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <UserAvatar user={payer} size={36} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{exp.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Paid by {payer.name} • {exp.date}
                        </div>
                      </div>
                    </div>

                    <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                      {formatCurrency(exp.amountCents)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
