import React, { useState, useMemo } from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, getHouseUsers } from '../features/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { exportAuditReportCsv } from '../features/exportCsv';
import { useAuth } from '../context/AuthContext';
import { CategoryChart } from '../components/CategoryChart';
import { UserAvatar } from '../components/UserAvatar';
import { MaterialSelect } from '../components/MaterialSelect';
import { Calendar, Users, Download, Printer } from 'lucide-react';

import type { Language } from '../utils/i18n';
import { toLocalMonthKey } from '../utils/localDate';
import { filterDashboardMonth, getDashboardMonths } from '../features/monthlyDashboard';

interface MonthlySummaryProps {
  expenses: Expense[];
  settlements: Settlement[];
  lang?: Language;
}

export const MonthlyPage: React.FC<MonthlySummaryProps> = ({ expenses, settlements, lang = 'en' }) => {
  const { currentHouse, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const currentMonthKey = toLocalMonthKey();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

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

  // Accrual performance is based on expenses incurred in the selected month.
  // Cash settlements remain in the audit export but do not distort that month's spend split.
  const monthBalances = useMemo(() => {
    return calculateNetBalances(monthExpenses, [], houseUsers);
  }, [monthExpenses, houseUsers]);
  const balanceUsers = useMemo(() => {
    const activeIds = new Set(houseUsers.map((user) => user.id));
    return [
      ...houseUsers,
      ...Object.values(monthBalances)
        .map((balance) => balance.user)
        .filter((user) => !activeIds.has(user.id)),
    ];
  }, [houseUsers, monthBalances]);

  const totalMonthSpentCents = monthExpenses.reduce((sum, e) => sum + e.amountCents, 0);

  const formattedMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header & Month Picker */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Monthly Financial Report</h1>
          <p className="page-description">
            Period overview, spend distributions, and housemate contribution ratios
          </p>
        </div>

        {/* Actions & Month Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary no-print"
            onClick={handlePrintPDF}
            title="Print or Save PDF Financial Statement"
          >
            <Printer size={16} />
            <span>Print / Save as PDF</span>
          </button>

          <button
            className="btn btn-secondary no-print"
            onClick={() => exportAuditReportCsv(monthExpenses, monthSettlements, `report_${selectedMonth}.csv`)}
            title="Download CSV Audit Report"
          >
            <Download size={16} />
            <span>Export CSV Report</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
            <MaterialSelect
              value={selectedMonth}
              onChange={setSelectedMonth}
              ariaLabel="Report month"
              style={{ width: '190px' }}
              options={availableMonths.map((mKey) => {
                const [y, m] = mKey.split('-');
                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return { value: mKey, label };
              })}
            />
          </div>
        </div>
      </div>

      {/* Hero Monthly Total Card */}
      <div
        className="glass-card monthly-hero-card"
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Total Spending — {formattedMonthLabel}
        </div>
        <div className="tabular-nums" style={{ fontSize: '2.6rem', fontWeight: 800, marginTop: '8px' }}>
          {formatCurrency(totalMonthSpentCents, false, lang)}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Across {monthExpenses.length} transactions logged in this billing period
        </div>
      </div>

      {/* Spend Analytics Component */}
      <CategoryChart expenses={monthExpenses} />

      {/* Housemate Spending Breakdown Grid */}
      <div>
        <div className="housemates-section-title">
          <Users size={20} style={{ color: 'var(--accent-primary)' }} />
          <span>{formattedMonthLabel} Housemate Performance</span>
        </div>
        <div className="grid-3">
          {balanceUsers.map((user) => {
            const b = monthBalances[user.id] || { totalPaidCents: 0, totalShareCents: 0, netBalanceCents: 0 };
            const net = b.netBalanceCents;

            return (
              <div key={user.id} className="glass-card user-balance-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <UserAvatar user={user} size={42} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Period Ledger</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Out-of-pocket Paid:</span>
                    <strong className="tabular-nums" style={{ color: user.color }}>{formatCurrency(b.totalPaidCents)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Assigned Share:</span>
                    <strong className="tabular-nums">{formatCurrency(b.totalShareCents)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '4px' }}>
                    <span style={{ fontWeight: 800 }}>Period Net:</span>
                    <strong className="tabular-nums" style={{ color: net > 0 ? 'var(--status-positive-text)' : net < 0 ? 'var(--status-negative-text)' : 'var(--text-primary)' }}>
                      {formatCurrency(net, true)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
