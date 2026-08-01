import React, { useState } from 'react';
import type { Expense, Category } from '../types';
import { formatCurrency } from '../utils/currency';
import type { Language } from '../utils/i18n';
import { ShoppingCart, Home, Zap, Utensils, User, HelpCircle } from 'lucide-react';

interface CategoryPieChartProps {
  expenses: Expense[];
  lang?: Language;
}

interface CategoryMeta {
  name: Category;
  color: string;
  icon: React.ElementType;
}

const CATEGORY_META: CategoryMeta[] = [
  { name: 'Groceries', color: '#e4e4e7', icon: ShoppingCart },
  { name: 'Household', color: '#10b981', icon: Home },
  { name: 'Utilities', color: '#f59e0b', icon: Zap },
  { name: 'Food', color: '#f43f5e', icon: Utensils },
  { name: 'Personal', color: '#a855f7', icon: User },
  { name: 'Other', color: '#06b6d4', icon: HelpCircle },
];

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ expenses, lang = 'en' }) => {
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null);

  // Aggregate category amounts
  const categoryTotals: Record<Category, number> = {
    Groceries: 0,
    Household: 0,
    Utilities: 0,
    Food: 0,
    Personal: 0,
    Other: 0,
  };

  let totalCents = 0;
  expenses.forEach((exp) => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amountCents;
    totalCents += exp.amountCents;
  });

  // Calculate SVG Donut Arcs
  let cumulativeAngle = 0;
  const radius = 78;
  const strokeWidth = 22;
  const center = 110;
  const circumference = 2 * Math.PI * radius;

  const slices = CATEGORY_META.map((cat) => {
    const amount = categoryTotals[cat.name];
    const percentage = totalCents > 0 ? (amount / totalCents) * 100 : 0;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativeAngle / 360) * circumference);
    cumulativeAngle += (percentage / 100) * 360;

    return {
      ...cat,
      amount,
      percentage,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSlice = hoveredCategory
    ? slices.find((s) => s.name === hoveredCategory)
    : null;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {totalCents === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No transaction data recorded yet to display category charts.
        </div>
      ) : (
        <>
          {/* SVG Donut Chart with Center Display */}
          <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto' }}>
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="var(--bg-surface-elevated)"
                strokeWidth={strokeWidth}
              />
              {slices.map((slice) => {
                if (slice.percentage === 0) return null;
                const isHovered = hoveredCategory === slice.name;
                return (
                  <circle
                    key={slice.name}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      opacity: hoveredCategory && !isHovered ? 0.45 : 1,
                    }}
                    onMouseEnter={() => setHoveredCategory(slice.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                );
              })}
            </svg>

            {/* Center Label inside Donut */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                textAlign: 'center',
                padding: '12px 24px', /* Padding respects the donut stroke width */
              }}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeSlice ? activeSlice.name : 'Total Spend'}
              </div>
              <div
                className="tabular-nums font-display"
                style={{
                  fontSize: activeSlice ? '0.95rem' : '1.05rem',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {activeSlice
                  ? formatCurrency(activeSlice.amount, false, lang)
                  : formatCurrency(totalCents, false, lang)}
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: activeSlice ? activeSlice.color : 'var(--accent-emerald)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {activeSlice ? `${activeSlice.percentage.toFixed(1)}%` : `${expenses.length} records`}
              </div>
            </div>
          </div>

          {/* Category Grid Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '4px' }}>
            {slices.map((slice) => {
              const IconComp = slice.icon;
              const isHovered = hoveredCategory === slice.name;
              return (
                <div
                  key={slice.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isHovered ? 'var(--bg-card-hover)' : 'var(--bg-input)',
                    border: `1px solid ${isHovered ? slice.color : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={() => setHoveredCategory(slice.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: slice.color,
                        boxShadow: `0 0 6px ${slice.color}`,
                      }}
                    />
                    <IconComp size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{slice.name}</span>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {slice.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
