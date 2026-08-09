import React, { useMemo, useState } from 'react';
import type { Category, Expense, Settlement, User } from '../types';
import { calculateNetBalances, calculateSimplifiedSettlements, getHouseUsers } from '../features/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { toLocalMonthKey } from '../utils/localDate';
import { filterDashboardMonth, getDashboardMonths, getHouseholdLedgerAsOfMonth } from '../features/monthlyDashboard';
import { UserAvatar } from '../components/UserAvatar';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  CreditCard,
  Home,
  Plus,
  Receipt,
  Shapes,
  ShoppingBasket,
  Sparkles,
  Utensils,
  UserRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import type { Language } from '../utils/i18n';
import { MaterialSelect } from '../components/MaterialSelect';

interface DashboardProps {
  expenses: Expense[];
  settlements: Settlement[];
  onNavigateToSettlement: () => void;
  onNavigateToExpenses: () => void;
  lang?: Language;
}

const categoryIcons: Record<Category, React.ComponentType<{ size?: number; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }>> = {
  Groceries: ShoppingBasket,
  Household: Home,
  Utilities: Zap,
  Food: Utensils,
  Personal: UserRound,
  Other: Shapes,
};

const resolvePayer = (expense: Expense, users: User[]): User =>
  users.find((user) => user.id === expense.paidBy || user.name.toLowerCase() === expense.paidBy.toLowerCase()) || {
    id: expense.paidBy,
    name: expense.paidBy,
    avatar: expense.paidBy,
    color: '#13a383',
  };

export const DashboardPage: React.FC<DashboardProps> = ({
  expenses,
  settlements,
  onNavigateToSettlement,
  onNavigateToExpenses,
  lang = 'en',
}) => {
  const { currentHouse, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);
  const currentMonthKey = useMemo(() => toLocalMonthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const availableMonths = useMemo(
    () => getDashboardMonths(expenses, settlements, currentMonthKey),
    [expenses, settlements, currentMonthKey]
  );
  const selectedData = useMemo(
    () => filterDashboardMonth(expenses, settlements, selectedMonth),
    [expenses, settlements, selectedMonth]
  );
  const monthExpenses = selectedData.expenses;
  const monthSettlements = selectedData.settlements;
  const asOfData = useMemo(
    () => getHouseholdLedgerAsOfMonth(expenses, settlements, selectedMonth),
    [expenses, settlements, selectedMonth]
  );

  const userBalances = useMemo(
    () => calculateNetBalances(asOfData.expenses, asOfData.settlements, houseUsers),
    [asOfData, houseUsers]
  );
  const simplifiedSettlements = useMemo(
    () => calculateSimplifiedSettlements(userBalances, houseUsers),
    [userBalances, houseUsers]
  );

  const selectedMonthSpentCents = useMemo(
    () => monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [monthExpenses]
  );
  const selectedMonthSettledCents = useMemo(
    () => monthSettlements
      .filter((settlement) => settlement.status === 'completed')
      .reduce((sum, settlement) => sum + settlement.amountCents, 0),
    [monthSettlements]
  );
  const totalPendingDebtCents = useMemo(
    () => simplifiedSettlements.reduce((sum, settlement) => sum + settlement.amountCents, 0),
    [simplifiedSettlements]
  );

  const selectedMonthLabel = useMemo(() => {
    const date = new Date(`${selectedMonth}-01`);
    return Number.isNaN(date.getTime())
      ? selectedMonth
      : date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth, lang]);

  const previousMonthSpentCents = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const previousMonthKey = toLocalMonthKey(new Date(year, month - 2, 1));
    return expenses
      .filter((expense) => expense.date.startsWith(previousMonthKey))
      .reduce((sum, expense) => sum + expense.amountCents, 0);
  }, [expenses, selectedMonth]);

  const monthChange = previousMonthSpentCents > 0
    ? Math.round(((selectedMonthSpentCents - previousMonthSpentCents) / previousMonthSpentCents) * 100)
    : null;

  const dailyTrend = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const totals = Array.from({ length: daysInMonth }, () => 0);
    monthExpenses.forEach((expense) => {
      const day = Number(expense.date.slice(8, 10));
      if (day >= 1 && day <= daysInMonth) totals[day - 1] += expense.amountCents;
    });
    const max = Math.max(...totals, 1);
    const points = totals.map((value, index) => {
      const x = totals.length === 1 ? 300 : (index / (totals.length - 1)) * 600;
      const y = 158 - (value / max) * 126;
      return { x, y, value };
    });
    return {
      totals,
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(' '),
      area: `0,170 ${points.map((point) => `${point.x},${point.y}`).join(' ')} 600,170`,
      max,
    };
  }, [monthExpenses, selectedMonth]);

  const categoryStats = useMemo(() => {
    const totals = new Map<Category, number>();
    monthExpenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amountCents));
    const sorted = Array.from(totals.entries())
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);
    const max = sorted[0]?.amountCents || 1;
    return sorted.map((item) => ({ ...item, percentage: (item.amountCents / max) * 100 }));
  }, [monthExpenses]);

  const paymentChannelStats = useMemo(() => {
    let cardCents = 0;
    let cashCents = 0;
    monthExpenses.forEach((expense) => {
      if (expense.paymentMethod?.type === 'card' || expense.paymentMethod?.cardId) cardCents += expense.amountCents;
      else cashCents += expense.amountCents;
    });
    const total = cardCents + cashCents;
    return {
      cardCents,
      cashCents,
      cardPercentage: total > 0 ? Math.round((cardCents / total) * 100) : 0,
      cashPercentage: total > 0 ? Math.round((cashCents / total) * 100) : 0,
    };
  }, [monthExpenses]);

  const memberCount = Math.max(1, houseUsers.length);
  const averagePerMemberCents = Math.round(selectedMonthSpentCents / memberCount);
  const balanceUsers = useMemo(() => {
    const activeIds = new Set(houseUsers.map((user) => user.id));
    return [
      ...houseUsers,
      ...Object.values(userBalances)
        .map((balance) => balance.user)
        .filter((user) => !activeIds.has(user.id)),
    ];
  }, [houseUsers, userBalances]);
  const currentUserId = dbUserProfile?.uid;
  const youOweCents = simplifiedSettlements
    .filter((settlement) => settlement.fromUser.id === currentUserId)
    .reduce((sum, settlement) => sum + settlement.amountCents, 0);
  const youAreOwedCents = simplifiedSettlements
    .filter((settlement) => settlement.toUser.id === currentUserId)
    .reduce((sum, settlement) => sum + settlement.amountCents, 0);
  const settlementTotal = selectedMonthSettledCents + totalPendingDebtCents;
  const settlementProgress = settlementTotal > 0
    ? Math.round((selectedMonthSettledCents / settlementTotal) * 100)
    : 100;
  const recentExpenses = [...monthExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="dashboard-v2">
      <div className="dashboard-mobile-brand" aria-hidden="true">
        <span className="dashboard-mobile-brand-mark"><Home size={19} /></span>
        <span>Home Finance</span>
      </div>

      <header className="dashboard-v2-header">
        <div className="dashboard-v2-heading">
          <nav className="dashboard-breadcrumb" aria-label="Breadcrumb">
            <span>Home</span><ArrowRight size={13} aria-hidden="true" /><span aria-current="page">Overview</span>
          </nav>
          <h1>Household overview</h1>
          <p>A clear view of spending, balances, and what comes next.</p>
        </div>

        <div className="dashboard-v2-actions">
          <div className="dashboard-month-selector dashboard-month-selector-v2">
            <CalendarDays size={17} aria-hidden="true" />
            <MaterialSelect
              compact
              value={selectedMonth}
              onChange={setSelectedMonth}
              ariaLabel="Dashboard month"
              options={availableMonths.map((monthKey) => {
                const date = new Date(`${monthKey}-01`);
                const label = Number.isNaN(date.getTime())
                  ? monthKey
                  : date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
                return { value: monthKey, label };
              })}
            />
          </div>
          <div className="dashboard-member-stack" aria-label={`${houseUsers.length} household members`}>
            {houseUsers.slice(0, 3).map((user) => <UserAvatar key={user.id} user={user} size={34} />)}
            {houseUsers.length > 3 && <span>+{houseUsers.length - 3}</span>}
          </div>
          <button className="btn dashboard-settle-button" onClick={onNavigateToSettlement}>
            <WalletCards size={17} aria-hidden="true" /><span>Settle up</span>
          </button>
          <button className="btn btn-primary dashboard-add-button" onClick={onNavigateToExpenses}>
            <Plus size={18} aria-hidden="true" /><span>Add expense</span>
          </button>
        </div>
      </header>

      <section className="dashboard-hero-grid" aria-label="Monthly household summary">
        <article className="dashboard-card dashboard-spend-card dashboard-reveal dashboard-reveal-1">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-eyebrow">Spent this month</span>
              <strong className="dashboard-hero-value tabular-nums">{formatCurrency(selectedMonthSpentCents, false, lang)}</strong>
            </div>
            <span className="dashboard-period-chip">{selectedMonthLabel}</span>
          </div>
          <div className={`dashboard-delta ${monthChange !== null && monthChange > 0 ? 'is-up' : 'is-down'}`}>
            {monthChange === null ? <Sparkles size={14} /> : monthChange > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{monthChange === null ? 'First month of comparison data' : `${Math.abs(monthChange)}% ${monthChange > 0 ? 'more' : 'less'} than last month`}</span>
          </div>
          {dailyTrend.totals.some(Boolean) ? (
            <div className="dashboard-mini-chart">
              <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={`Daily household spending trend for ${selectedMonthLabel}`}>
                <defs>
                  <linearGradient id="dashboardTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="42" x2="600" y2="42" className="dashboard-chart-gridline" />
                <line x1="0" y1="105" x2="600" y2="105" className="dashboard-chart-gridline" />
                <polygon points={dailyTrend.area} fill="url(#dashboardTrendFill)" />
                <polyline points={dailyTrend.line} className="dashboard-chart-line" />
                {dailyTrend.points.filter((_, index) => index % Math.max(1, Math.floor(dailyTrend.points.length / 7)) === 0 || index === dailyTrend.points.length - 1).map((point, index) => (
                  <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="4" className="dashboard-chart-point" />
                ))}
              </svg>
              <div className="dashboard-chart-axis"><span>1</span><span>{Math.ceil(dailyTrend.totals.length / 2)}</span><span>{dailyTrend.totals.length}</span></div>
            </div>
          ) : (
            <div className="dashboard-chart-empty">Add an expense to start your monthly trend.</div>
          )}
        </article>

        <article className="dashboard-card dashboard-outstanding-card dashboard-reveal dashboard-reveal-2">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-eyebrow">Outstanding</span>
              <strong className="dashboard-card-value tabular-nums">{formatCurrency(totalPendingDebtCents, false, lang)}</strong>
              <span className="dashboard-card-caption">{simplifiedSettlements.length} active transfer{simplifiedSettlements.length === 1 ? '' : 's'}</span>
            </div>
            <span className="dashboard-icon-button" aria-hidden="true"><WalletCards size={19} /></span>
          </div>
          <button className="dashboard-lime-action" onClick={onNavigateToSettlement}>
            <span>{totalPendingDebtCents > 0 ? 'Settle up' : 'View settlements'}</span><ArrowRight size={17} />
          </button>
          <div className="dashboard-debt-breakdown">
            <div><span>You owe</span><strong>{formatCurrency(youOweCents, false, lang)}</strong></div>
            <div><span>You are owed</span><strong>{formatCurrency(youAreOwedCents, false, lang)}</strong></div>
          </div>
        </article>

        <article className="dashboard-card dashboard-health-card dashboard-reveal dashboard-reveal-3">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-eyebrow">Settlement health</span>
              <strong className="dashboard-health-status">{totalPendingDebtCents === 0 ? 'All clear' : 'In progress'}</strong>
            </div>
            <span className="dashboard-icon-button" aria-hidden="true"><Check size={19} /></span>
          </div>
          <p>{totalPendingDebtCents === 0 ? 'Everyone is settled as of this month-end.' : 'Outstanding transfers are ready to review.'}</p>
          <div className="dashboard-progress-heading"><span>Resolved value</span><strong>{settlementProgress}%</strong></div>
          <div className="dashboard-progress" role="progressbar" aria-label="Settlement value resolved" aria-valuenow={settlementProgress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${settlementProgress}%` }} />
          </div>
          <span className="dashboard-card-caption">{formatCurrency(selectedMonthSettledCents, false, lang)} completed this month</span>
        </article>
      </section>

      <section className="dashboard-analysis-grid" aria-label="Spending analysis">
        <article className="dashboard-card dashboard-trend-card dashboard-reveal dashboard-reveal-2">
          <div className="dashboard-section-heading">
            <div><h2>Spending trend</h2><p>Daily totals across {selectedMonthLabel}</p></div>
            <span className="dashboard-metric-note">{monthExpenses.length} expenses</span>
          </div>
          {dailyTrend.totals.some(Boolean) ? (
            <div className="dashboard-large-chart">
              <div className="dashboard-y-axis"><span>{formatCurrency(dailyTrend.max, false, lang)}</span><span>{formatCurrency(Math.round(dailyTrend.max / 2), false, lang)}</span><span>{formatCurrency(0, false, lang)}</span></div>
              <div className="dashboard-large-chart-plot">
                <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={`Daily spending line chart for ${selectedMonthLabel}`}>
                  <line x1="0" y1="32" x2="600" y2="32" className="dashboard-chart-gridline" />
                  <line x1="0" y1="95" x2="600" y2="95" className="dashboard-chart-gridline" />
                  <line x1="0" y1="158" x2="600" y2="158" className="dashboard-chart-gridline" />
                  <polygon points={dailyTrend.area} fill="url(#dashboardTrendFill)" />
                  <polyline points={dailyTrend.line} className="dashboard-chart-line" />
                </svg>
                <div className="dashboard-chart-axis"><span>Day 1</span><span>Day {Math.ceil(dailyTrend.totals.length / 2)}</span><span>Day {dailyTrend.totals.length}</span></div>
              </div>
            </div>
          ) : <div className="dashboard-chart-empty dashboard-chart-empty-large">No spending data for this month yet.</div>}
        </article>

        <article className="dashboard-card dashboard-category-card dashboard-reveal dashboard-reveal-3">
          <div className="dashboard-section-heading">
            <div><h2>By category</h2><p>Largest spending areas</p></div>
          </div>
          {categoryStats.length > 0 ? (
            <div className="dashboard-category-list">
              {categoryStats.slice(0, 5).map((item) => {
                const Icon = categoryIcons[item.category];
                return (
                  <div className="dashboard-category-row" key={item.category}>
                    <span className="dashboard-category-icon"><Icon size={15} aria-hidden="true" /></span>
                    <span className="dashboard-category-name">{item.category}</span>
                    <span className="dashboard-category-track"><span style={{ width: `${item.percentage}%` }} /></span>
                    <strong className="tabular-nums">{formatCurrency(item.amountCents, false, lang)}</strong>
                  </div>
                );
              })}
            </div>
          ) : <div className="dashboard-chart-empty">Categories will appear after the first expense.</div>}
          <button className="dashboard-text-link" onClick={onNavigateToExpenses}>View all expenses <ArrowRight size={15} /></button>
        </article>

        <article className="dashboard-card dashboard-payment-card dashboard-reveal dashboard-reveal-4">
          <div className="dashboard-section-heading">
            <div><h2>Payment mix</h2><p>Card and cash outlays</p></div>
          </div>
          <div className="dashboard-payment-body">
            <div
              className="dashboard-donut"
              style={{ '--dashboard-card-share': `${paymentChannelStats.cardPercentage * 3.6}deg` } as React.CSSProperties}
              role="img"
              aria-label={`${paymentChannelStats.cardPercentage}% card and ${paymentChannelStats.cashPercentage}% cash`}
            ><span>{paymentChannelStats.cardPercentage}%</span></div>
            <div className="dashboard-payment-legend">
              <div><span className="dashboard-payment-icon is-card"><CreditCard size={16} /></span><span><small>Card</small><strong>{paymentChannelStats.cardPercentage}%</strong></span></div>
              <div><span className="dashboard-payment-icon is-cash"><Banknote size={16} /></span><span><small>Cash</small><strong>{paymentChannelStats.cashPercentage}%</strong></span></div>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid" aria-label="Household activity">
        <article className="dashboard-card dashboard-balances-card dashboard-reveal dashboard-reveal-3">
          <div className="dashboard-section-heading">
            <div><h2>Housemate balances</h2><p>Positions as of {selectedMonthLabel} month-end</p></div>
            <button className="dashboard-text-link" onClick={onNavigateToSettlement}>View all <ArrowRight size={15} /></button>
          </div>
          {balanceUsers.length > 0 ? (
            <div className="dashboard-balance-list">
              {balanceUsers.map((user) => {
                const netCents = userBalances[user.id]?.netBalanceCents || 0;
                const status = netCents > 0 ? 'gets back' : netCents < 0 ? 'owes' : 'settled';
                return (
                  <div className="dashboard-balance-person" key={user.id}>
                    <UserAvatar user={user} size={42} />
                    <span><strong>{user.name}</strong><small className={`is-${status.replace(' ', '-')}`}>{status}</small></span>
                    <b className="tabular-nums">{netCents > 0 ? '+' : ''}{formatCurrency(netCents, false, lang)}</b>
                  </div>
                );
              })}
            </div>
          ) : <div className="dashboard-chart-empty">Housemate balances will appear after household setup.</div>}
          <div className="dashboard-average-note"><span>Average per member</span><strong>{formatCurrency(averagePerMemberCents, false, lang)}</strong></div>
        </article>

        <article className="dashboard-card dashboard-recent-card dashboard-reveal dashboard-reveal-4">
          <div className="dashboard-section-heading">
            <div><h2>Recent expenses</h2><p>Latest shared household activity</p></div>
            <button className="dashboard-text-link" onClick={onNavigateToExpenses}>View all <ArrowRight size={15} /></button>
          </div>
          {recentExpenses.length > 0 ? (
            <div className="dashboard-recent-list">
              {recentExpenses.map((expense) => {
                const payer = resolvePayer(expense, houseUsers);
                const Icon = categoryIcons[expense.category];
                const date = new Date(`${expense.date}T00:00:00`);
                return (
                  <button className="dashboard-expense-row" key={expense.id} onClick={onNavigateToExpenses} aria-label={`View ${expense.title} expense`}>
                    <span className="dashboard-date-tile"><small>{date.toLocaleDateString('en-US', { month: 'short' })}</small><strong>{date.getDate()}</strong></span>
                    <UserAvatar user={payer} size={34} />
                    <span className="dashboard-expense-copy"><strong>{expense.title}</strong><small><Icon size={13} aria-hidden="true" /> {expense.category} / Paid by {payer.name}</small></span>
                    <b className="tabular-nums">{formatCurrency(expense.amountCents, false, lang)}</b>
                  </button>
                );
              })}
            </div>
          ) : (
            <button className="dashboard-empty-action" onClick={onNavigateToExpenses}><Receipt size={18} /><span>No expenses yet. Add the first one.</span></button>
          )}
        </article>
      </section>
    </div>
  );
};
