import React, { useMemo } from 'react';
import type { Expense, Category, User as UserType } from '../types';
import { formatCurrency } from '../utils/currency';
import { getHouseUsers } from '../utils/settlementEngine';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ShoppingCart, Home, Zap, Utensils, User, HelpCircle, PieChart } from 'lucide-react';

interface CategoryChartProps {
  expenses: Expense[];
}

interface IconProps {
  size?: number;
}

interface CategoryItem {
  name: Category;
  icon: React.FC<IconProps>;
  color: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: 'Groceries', icon: ShoppingCart, color: '#3b82f6' },
  { name: 'Household', icon: Home, color: '#10b981' },
  { name: 'Utilities', icon: Zap, color: '#f59e0b' },
  { name: 'Food', icon: Utensils, color: '#f43f5e' },
  { name: 'Personal', icon: User, color: '#8b5cf6' },
  { name: 'Other', icon: HelpCircle, color: '#06b6d4' },
];

export const CategoryChart: React.FC<CategoryChartProps> = ({ expenses }) => {
  // Aggregate total expenses by category
  const categoryTotals: Record<Category, number> = {
    Groceries: 0,
    Household: 0,
    Utilities: 0,
    Food: 0,
    Personal: 0,
    Other: 0,
  };

  let grandTotalCents = 0;

  expenses.forEach((e) => {
    categoryTotals[e.category] += e.amountCents;
    grandTotalCents += e.amountCents;
  });

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Category Spending</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Distribution across active household categories</p>
        </div>
        <span className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
          {formatCurrency(grandTotalCents)}
        </span>
      </div>

      <div className="bar-chart-list">
        {CATEGORIES.map(({ name, icon: IconComponent, color }) => {
          const amountCents = categoryTotals[name];
          const percent = grandTotalCents > 0 ? (amountCents / grandTotalCents) * 100 : 0;

          return (
            <div key={name} className="chart-bar-row">
              <div className="chart-bar-meta">
                <div className="chart-bar-label">
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: `${color}20`,
                      color: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComponent size={14} />
                  </span>
                  <span>{name}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{percent.toFixed(1)}%</span>
                  <span className="tabular-nums" style={{ fontWeight: 700 }}>
                    {formatCurrency(amountCents)}
                  </span>
                </div>
              </div>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                    boxShadow: percent > 0 ? `0 0 10px ${color}60` : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PayerContributionCard: React.FC<CategoryChartProps> = ({ expenses }) => {
  const { currentHouse, dbUserProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const grandTotalCents = useMemo(() => expenses.reduce((sum, e) => sum + e.amountCents, 0), [expenses]);

  // Calculate member contribution ratios dynamically
  const userContributions = useMemo(() => {
    return houseUsers.map((user: UserType) => {
      const totalPaid = expenses
        .filter((e) => e.paidBy === user.id || e.paidBy.toLowerCase() === user.name.toLowerCase())
        .reduce((sum, e) => sum + e.amountCents, 0);

      const percentage = grandTotalCents > 0 ? (totalPaid / grandTotalCents) * 100 : 0;
      return { user, totalPaid, percentage };
    });
  }, [expenses, houseUsers, grandTotalCents]);

  return (
    <div className="glass-card">
      <div style={{ marginBottom: '18px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Payer Out-of-Pocket Contribution Ratio</span>
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proportion of total expenses paid out-of-pocket by housemate</p>
      </div>

      {/* Multi-segmented ratio bar */}
      <div
        style={{
          width: '100%',
          height: '14px',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          display: 'flex',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          marginBottom: '20px',
        }}
      >
        {userContributions.map(({ user, percentage }: { user: UserType; percentage: number }) => (
          <div
            key={user.id}
            style={{
              width: `${percentage}%`,
              backgroundColor: user.color,
              transition: 'width 0.6s ease',
            }}
            title={`${user.name}: ${percentage.toFixed(1)}%`}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {userContributions.map(({ user, totalPaid, percentage }: { user: UserType; totalPaid: number; percentage: number }) => (
          <div
            key={user.id}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserAvatar user={user} size={32} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{percentage.toFixed(1)}% of total</div>
              </div>
            </div>
            <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1rem' }}>
              {formatCurrency(totalPaid)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
