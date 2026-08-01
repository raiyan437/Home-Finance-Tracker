import React, { useMemo } from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from '../features/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { CategoryChart, PayerContributionCard } from '../components/CategoryChart';
import { CategoryPieChart } from '../components/CategoryPieChart';
import { UserAvatar } from '../components/UserAvatar';
import { TrendingUp, ArrowRight, CheckCircle2, Receipt, Activity, CreditCard, Banknote, Users, PieChart } from 'lucide-react';
import type { Language } from '../utils/i18n';

interface DashboardProps {
  expenses: Expense[];
  settlements: Settlement[];
  onNavigateToSettlement: () => void;
  onNavigateToExpenses: () => void;
  lang?: Language;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  expenses,
  settlements,
  onNavigateToSettlement,
  onNavigateToExpenses,
  lang = 'en',
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

  // Calculate Current Month Spend & Cumulative Month Spend
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.date && e.date.startsWith(currentMonthStr));
  }, [expenses, currentMonthStr]);

  const currentMonthSpentCents = useMemo(() => {
    return currentMonthExpenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  }, [currentMonthExpenses]);

  const currentMonthLabel = useMemo(() => {
    const d = new Date(currentMonthStr + '-01');
    return isNaN(d.getTime())
      ? currentMonthStr
      : d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
  }, [currentMonthStr, lang]);

  // Calculate total pending debt in household
  const totalPendingDebtCents = simplifiedSettlements.reduce((sum, st) => sum + st.amountCents, 0);

  const memberCount = Math.max(1, houseUsers.length);
  const currentMonthAveragePerMemberCents = Math.round(currentMonthSpentCents / memberCount);
  const memberNamesText = houseUsers.map((u) => u.name).join(', ');

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Calculate Payment Channel Ratios (Bank Cards vs Cash)
  const paymentChannelStats = useMemo(() => {
    let cardCents = 0;
    let cashCents = 0;

    expenses.forEach((exp) => {
      if (exp.paymentMethod?.type === 'card' || exp.paymentMethod?.cardId) {
        cardCents += exp.amountCents;
      } else {
        cashCents += exp.amountCents;
      }
    });

    const grandTotal = cardCents + cashCents;
    const cardPercentage = grandTotal > 0 ? (cardCents / grandTotal) * 100 : 0;
    const cashPercentage = grandTotal > 0 ? (cashCents / grandTotal) * 100 : 0;

    return { cardCents, cashCents, cardPercentage, cashPercentage };
  }, [expenses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner & Quick Metrics Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Household Financial Dashboard</h1>
          <p className="page-description">
            Live overview of household expenses, net debtor positions, and settlement recommendations for {memberNamesText}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onNavigateToExpenses}>
            <span>Log Expense</span>
            <Receipt size={16} />
          </button>
          <button className="btn btn-secondary" onClick={onNavigateToSettlement}>
            <span>Settlement Hub</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Top Summary Metric Cards */}
      <div className="grid-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
        {/* Metric 1: Current Month Spend */}
        <div className="glass-card summary-card animate-stagger-1">
          <div className="summary-card-header">
            <span className="summary-title">Current Month Spend</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="summary-amount tabular-nums font-display" style={{ color: 'var(--accent-primary)' }}>
            {formatCurrency(currentMonthSpentCents, false, lang)}
          </div>
          <div className="summary-footer">
            <span>Spent in {currentMonthLabel} ({currentMonthExpenses.length} items)</span>
          </div>
        </div>

        {/* Metric 2: Cumulative Total Spend (Current Month) */}
        <div className="glass-card summary-card animate-stagger-2">
          <div className="summary-card-header">
            <span className="summary-title">Cumulative Total Spend</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>
              <Receipt size={22} />
            </div>
          </div>
          <div className="summary-amount tabular-nums font-display" style={{ color: 'var(--accent-purple)' }}>
            {formatCurrency(currentMonthSpentCents, false, lang)}
          </div>
          <div className="summary-footer">
            <span>Cumulative total for {currentMonthLabel}</span>
          </div>
        </div>

        {/* Metric 3: Total Outstanding Debt */}
        <div className="glass-card summary-card animate-stagger-3">
          <div className="summary-card-header">
            <span className="summary-title">Outstanding Debt</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Activity size={22} />
            </div>
          </div>
          <div className="summary-amount tabular-nums font-display" style={{ color: 'var(--accent-amber)' }}>
            {formatCurrency(totalPendingDebtCents, false, lang)}
          </div>
          <div className="summary-footer">
            <span>{simplifiedSettlements.length} active settlement transfers needed</span>
          </div>
        </div>

        {/* Metric 4: Average Per Member */}
        <div className="glass-card summary-card animate-stagger-4">
          <div className="summary-card-header">
            <span className="summary-title">Average Per Member</span>
            <div className="summary-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div className="summary-amount tabular-nums font-display" style={{ color: 'var(--accent-emerald)' }}>
            {formatCurrency(currentMonthAveragePerMemberCents, false, lang)}
          </div>
          <div className="summary-footer">
            <span>Fair share target for {currentMonthLabel}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="dashboard-main-grid">
        
        {/* Left Column: Housemate Net Balances, Debt Action Cards, Recent History & Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Housemate Net Balances Grid */}
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Housemate Net Balances ({houseUsers.length})</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {houseUsers.map((user) => {
                const netCents = userBalances[user.id]?.netBalanceCents || 0;
                const isCreditor = netCents > 0;
                const isDebtor = netCents < 0;
                const paidCents = expenses
                  .filter((e) => e.paidBy === user.id || e.paidBy.toLowerCase() === user.name.toLowerCase())
                  .reduce((sum, e) => sum + e.amountCents, 0);

                return (
                  <div key={user.id} className="glass-card balance-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserAvatar user={user} size={42} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Paid {formatCurrency(paidCents, false, lang)} out-of-pocket
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                        Net Position
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 900,
                          color: isCreditor
                            ? 'var(--accent-emerald)'
                            : isDebtor
                            ? 'var(--accent-rose)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {isCreditor ? `+${formatCurrency(netCents, false, lang)}` : formatCurrency(netCents, false, lang)}
                      </div>
                      <div style={{ fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
                        {isCreditor && <span style={{ color: 'var(--accent-emerald)' }}>Gets back overall</span>}
                        {isDebtor && <span style={{ color: 'var(--accent-rose)' }}>Owes overall</span>}
                        {!isCreditor && !isDebtor && <span style={{ color: 'var(--text-muted)' }}>Fully settled</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {userBalances['legacy-user'] && (userBalances['legacy-user'].totalPaidCents > 0 || userBalances['legacy-user'].totalShareCents > 0) && (
                <div className="glass-card balance-card" style={{ opacity: 0.85, borderStyle: 'dashed' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <UserAvatar user={userBalances['legacy-user'].user} size={42} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                        {userBalances['legacy-user'].user.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Isolated legacy member balance pool
                      </div>
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                    {formatCurrency(userBalances['legacy-user'].netBalanceCents, false, lang)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Direct Debt Settlement Action Cards */}
          {simplifiedSettlements.length > 0 && (
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    Optimized Debt Settlement Payments ({simplifiedSettlements.length})
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Minimum cash flow algorithm solved to eliminate redundant transactions
                  </p>
                </div>

                <button className="btn btn-primary btn-sm" onClick={onNavigateToSettlement}>
                  <span>Settlement Hub</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {simplifiedSettlements.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <UserAvatar user={tx.fromUser} size={34} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{tx.fromUser.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-rose)' }}>Owes debt</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <ArrowRight size={16} style={{ color: 'var(--accent-amber)' }} />
                      <span className="tabular-nums" style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--accent-amber)' }}>
                        {formatCurrency(tx.amountCents, false, lang)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', textAlign: 'right' }}>{tx.toUser.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', textAlign: 'right' }}>Receives payment</div>
                      </div>
                      <UserAvatar user={tx.toUser} size={34} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Recent Shared Expenses List */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Recent Shared Expenses
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={onNavigateToExpenses}>
                <span>View All</span>
                <Receipt size={15} />
              </button>
            </div>

            {recentExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No expenses recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserAvatar user={payer} size={34} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{exp.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Paid by {payer.name} • {exp.date}
                          </div>
                        </div>
                      </div>

                      <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1rem' }}>
                        {formatCurrency(exp.amountCents, false, lang)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Payer Out-of-Pocket Contribution Ratio Card (Moved to Left Column beneath Recent Expenses) */}
          <PayerContributionCard expenses={expenses} />

          {/* 5. Payment Channel Distribution Card (Bank Cards vs Cash) */}
          <div className="glass-card">
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Payment Channel Distribution</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Bank Credit/Debit Cards vs Cash outlays ratio
              </p>
            </div>

            {/* Channel Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '14px',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                display: 'flex',
                backgroundColor: 'var(--bg-surface-elevated)',
                marginBottom: '18px',
              }}
            >
              <div
                style={{
                  width: `${paymentChannelStats.cardPercentage}%`,
                  backgroundColor: 'var(--accent-cyan)',
                  transition: 'width 0.6s ease',
                }}
                title={`Bank Cards: ${paymentChannelStats.cardPercentage.toFixed(1)}%`}
              />
              <div
                style={{
                  width: `${paymentChannelStats.cashPercentage}%`,
                  backgroundColor: 'var(--accent-amber)',
                  transition: 'width 0.6s ease',
                }}
                title={`Cash: ${paymentChannelStats.cashPercentage.toFixed(1)}%`}
              />
            </div>

            {/* Payment Channel Stat Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <CreditCard size={15} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Bank Cards</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  {formatCurrency(paymentChannelStats.cardCents, false, lang)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {paymentChannelStats.cardPercentage.toFixed(1)}% of total
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Banknote size={15} style={{ color: 'var(--accent-amber)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Cash Payments</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                  {formatCurrency(paymentChannelStats.cashCents, false, lang)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {paymentChannelStats.cashPercentage.toFixed(1)}% of total
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Visual Category Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Category Donut Pie Chart */}
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Category Spending Breakdown</span>
            </h2>
            <CategoryPieChart expenses={expenses} lang={lang} />
          </div>

          {/* 2. Category Progress Bars */}
          <CategoryChart expenses={expenses} />

        </div>

      </div>
    </div>
  );
};
