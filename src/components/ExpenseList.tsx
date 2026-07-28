import React, { useState, useMemo } from 'react';
import type { Expense, UserId, Category, PaymentCard } from '../types';
import { USERS, ALL_USERS } from '../utils/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { UserAvatar } from './UserAvatar';
import { Search, Edit, Trash2, Plus, Receipt, ChevronDown, ChevronUp, Filter, FileText, CreditCard, Banknote } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  cards?: PaymentCard[];
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const ALL_CATEGORIES: (Category | 'All')[] = ['All', 'Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  cards = [],
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedUserFilter, setSelectedUserFilter] = useState<UserId | 'All'>('All');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'All' | 'cash' | 'card'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cardsMap = useMemo(() => {
    const map: Record<string, PaymentCard> = {};
    cards.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [cards]);

  // Filter logic
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = exp.title.toLowerCase().includes(q);
          const matchesNotes = exp.notes?.toLowerCase().includes(q);
          const matchesCategory = exp.category.toLowerCase().includes(q);
          const matchesPayer = USERS[exp.paidBy].name.toLowerCase().includes(q);
          if (!matchesTitle && !matchesNotes && !matchesCategory && !matchesPayer) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'All' && exp.category !== selectedCategory) {
          return false;
        }

        // Person filter (paid by OR participant)
        if (selectedUserFilter !== 'All') {
          const isPayer = exp.paidBy === selectedUserFilter;
          const isParticipant = exp.shares.some((s) => s.userId === selectedUserFilter);
          if (!isPayer && !isParticipant) return false;
        }

        // Payment Channel filter
        if (selectedPaymentFilter !== 'All') {
          const type = exp.paymentMethod?.type || 'cash';
          if (type !== selectedPaymentFilter) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, searchQuery, selectedCategory, selectedUserFilter, selectedPaymentFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Expense Log</h1>
          <p className="page-description">
            Complete audit trail of all shared household purchases, splits, payment channels, and custom allocations
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenAddExpense}>
          <Plus size={18} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '18px' }}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {/* Search Input */}
          <div className="search-input-wrapper">
            <Search size={18} />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search expenses by title, note, payer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ width: '160px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as Category | 'All')}
            >
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Person Filter */}
          <select
            className="form-select"
            style={{ width: '160px' }}
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value as UserId | 'All')}
          >
            <option value="All">All Housemates</option>
            {ALL_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                Payer/Participant: {u.name}
              </option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            className="form-select"
            style={{ width: '150px' }}
            value={selectedPaymentFilter}
            onChange={(e) => setSelectedPaymentFilter(e.target.value as 'All' | 'cash' | 'card')}
          >
            <option value="All">All Payments</option>
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Bank Card</option>
          </select>

          {(searchQuery || selectedCategory !== 'All' || selectedUserFilter !== 'All' || selectedPaymentFilter !== 'All') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedUserFilter('All');
                setSelectedPaymentFilter('All');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Expense Cards List */}
      {filteredExpenses.length === 0 ? (
        <div className="glass-card empty-state">
          <Receipt className="empty-icon" />
          <div className="empty-title">No matching expenses found</div>
          <p style={{ fontSize: '0.85rem' }}>Try clearing your active search filters or add a new expense.</p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedUserFilter('All');
              setSelectedPaymentFilter('All');
            }}
          >
            Clear Active Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredExpenses.map((exp) => {
            const payer = USERS[exp.paidBy];
            const isExpanded = expandedId === exp.id;
            const pm = exp.paymentMethod;
            const cardObj = pm?.type === 'card' && pm.cardId ? cardsMap[pm.cardId] : null;

            return (
              <div
                key={exp.id}
                className="expense-item-card"
                style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }}
                onClick={() => toggleExpand(exp.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  {/* Left Metadata */}
                  <div className="expense-left">
                    <UserAvatar user={payer} size={44} />
                    <div className="expense-info-group">
                      <div className="expense-title-row">
                        <span className="expense-title">{exp.title}</span>
                        <span className={`cat-pill cat-${exp.category}`}>{exp.category}</span>
                        
                        {/* Payment Channel Badge */}
                        <span className="share-mini-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                          {pm?.type === 'card' ? (
                            <>
                              <CreditCard size={12} style={{ color: 'var(--accent-primary)' }} />
                              <span>{cardObj ? cardObj.bankName : 'Bank Card'}</span>
                            </>
                          ) : (
                            <>
                              <Banknote size={12} style={{ color: 'var(--accent-emerald)' }} />
                              <span>Cash</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="expense-meta-row">
                        <span>Paid by <strong>{payer.name}</strong></span>
                        <span>•</span>
                        <span>{exp.date}</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{exp.splitMethod} Split</span>
                      </div>
                      
                      {/* Mini Participant Share Pills */}
                      <div className="expense-shares-list">
                        {exp.shares.map((s) => (
                          <span key={s.userId} className="share-mini-tag">
                            {USERS[s.userId].name}: {formatCurrency(s.amountCents)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions & Amount */}
                  <div className="expense-right">
                    <div style={{ textAlign: 'right' }}>
                      <div className="expense-amount-display tabular-nums">{formatCurrency(exp.amountCents)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {exp.shares.length} participant{exp.shares.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="expense-actions-group" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        title="Edit expense"
                        onClick={() => onEditExpense(exp)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn btn-danger btn-icon-only"
                        title="Delete expense"
                        onClick={() => onDeleteExpense(exp.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        onClick={() => toggleExpand(exp.id)}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Shares Breakdown */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {exp.notes && (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-input)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                        <span><strong>Notes:</strong> {exp.notes}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Detailed Share Allocation
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      {exp.shares.map((share) => {
                        const user = USERS[share.userId];
                        return (
                          <div
                            key={share.userId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              backgroundColor: 'var(--bg-input)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <UserAvatar user={user} size={26} />
                              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{user.name}</span>
                            </div>
                            <span className="tabular-nums" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                              {formatCurrency(share.amountCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
