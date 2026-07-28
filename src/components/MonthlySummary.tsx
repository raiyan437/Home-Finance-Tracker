import React, { useState, useMemo } from 'react';
import type { Expense, Settlement } from '../types';
import { calculateNetBalances, ALL_USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { exportAuditReportCsv } from '../utils/exportCsv';
import { CategoryChart } from './CategoryChart';
import { UserAvatar } from './UserAvatar';
import { Calendar, Users, Download } from 'lucide-react';

interface MonthlySummaryProps {
  expenses: Expense[];
  settlements: Settlement[];
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({ expenses, settlements }) => {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonthKey);
    expenses.forEach((exp) => {
      if (exp.date) {
        months.add(exp.date.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [expenses, currentMonthKey]);

  const monthExpenses = useMemo(() => {
    return expenses.filter((exp) => exp.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const monthBalances = useMemo(() => {
    return calculateNetBalances(monthExpenses, settlements);
  }, [monthExpenses, settlements]);

  const totalMonthSpentCents = monthExpenses.reduce((sum, e) => sum + e.amountCents, 0);

  const formattedMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

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
            className="btn btn-secondary"
            onClick={() => exportAuditReportCsv(monthExpenses, settlements, `report_${selectedMonth}.csv`)}
            title="Download CSV Audit Report"
          >
            <Download size={16} />
            <span>Export CSV Report</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
            <select
              className="form-select"
              style={{ width: '190px', fontWeight: 800 }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((mKey) => {
                const [y, m] = mKey.split('-');
                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return (
                  <option key={mKey} value={mKey}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Hero Monthly Total Card */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Total Spending — {formattedMonthLabel}
        </div>
        <div className="tabular-nums" style={{ fontSize: '2.6rem', fontWeight: 800, marginTop: '8px' }}>
          {formatCurrency(totalMonthSpentCents)}
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
          {ALL_USERS.map((user) => {
            const b = monthBalances[user.id];
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
                    <span style={{ color: 'var(--text-muted)' }}>Target Fair Share:</span>
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
