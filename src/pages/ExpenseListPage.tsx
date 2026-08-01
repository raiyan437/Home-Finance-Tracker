import React, { useState, useMemo } from 'react';
import type { Expense, UserId, Category, PaymentCard } from '../types';
import { USERS, getHouseUsers } from '../features/settlementEngine';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { exportAuditReportCsv } from '../features/exportCsv';
import { UserAvatar } from '../components/UserAvatar';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { Search, Edit, Trash2, Plus, ChevronDown, ChevronUp, FileText, CreditCard, Banknote, Download, RefreshCw, Paperclip, X, MessageSquare, Send } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  cards?: PaymentCard[];
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onAddComment?: (expenseId: string, commentText: string) => void;
  onDeleteComment?: (expenseId: string, commentId: string) => void;
  lang?: Language;
}

const ALL_CATEGORIES: (Category | 'All')[] = ['All', 'Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other'];

export const ExpenseListPage: React.FC<ExpenseListProps> = ({
  expenses,
  cards = [],
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onAddComment,
  onDeleteComment,
  lang = 'en',
}) => {
  const { currentHouse, activeUserId, dbUserProfile, userProfile } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const myUid = dbUserProfile?.uid || activeUserId;
  const isLeader = Boolean(
    dbUserProfile?.role === 'leader' ||
    (currentHouse && currentHouse.leaderUid && (currentHouse.leaderUid === dbUserProfile?.uid || currentHouse.leaderUid === activeUserId))
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedUserFilter, setSelectedUserFilter] = useState<UserId | 'All'>('All');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'All' | 'cash' | 'card'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

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
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = exp.title.toLowerCase().includes(q);
          const matchesNotes = exp.notes?.toLowerCase().includes(q);
          const matchesCategory = exp.category.toLowerCase().includes(q);
          const matchesPayer = (USERS[exp.paidBy]?.name || exp.paidBy || '').toLowerCase().includes(q);
          if (!matchesTitle && !matchesNotes && !matchesCategory && !matchesPayer) {
            return false;
          }
        }

        if (selectedCategory !== 'All' && exp.category !== selectedCategory) {
          return false;
        }

        if (selectedUserFilter !== 'All') {
          const isPayer = exp.paidBy === selectedUserFilter;
          const isParticipant = exp.shares.some((s) => s.userId === selectedUserFilter);
          if (!isPayer && !isParticipant) return false;
        }

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

  const handleSendComment = (expenseId: string) => {
    const text = newCommentText[expenseId]?.trim();
    if (!text || !onAddComment) return;

    onAddComment(expenseId, text);
    setNewCommentText({ ...newCommentText, [expenseId]: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{getTranslation('householdExpenses', lang)}</h1>
          <p className="page-description">
            Complete audit trail of shared household purchases with dynamic participant splits & receipts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => exportAuditReportCsv(expenses)}>
            <Download size={16} />
            <span>{getTranslation('exportCsv', lang)}</span>
          </button>
          <button className="btn btn-primary" onClick={onOpenAddExpense}>
            <Plus size={18} />
            <span>{getTranslation('addExpense', lang)}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar & Search Bar */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder={getTranslation('searchExpenses', lang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Category | 'All')}
          >
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? getTranslation('allCategories', lang) : cat}
              </option>
            ))}
          </select>

          {/* Housemate Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value as UserId | 'All')}
          >
            <option value="All">{getTranslation('allHousemates', lang)}</option>
            {houseUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={selectedPaymentFilter}
            onChange={(e) => setSelectedPaymentFilter(e.target.value as any)}
          >
            <option value="All">{getTranslation('allPayments', lang)}</option>
            <option value="cash">{getTranslation('cash', lang)}</option>
            <option value="card">{getTranslation('bankCard', lang)}</option>
          </select>
        </div>
      </div>

      {/* Expense Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredExpenses.length === 0 ? (
          <div className="glass-card empty-state">
            <FileText className="empty-icon" />
            <div className="empty-title">No expenses found</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Try adjusting your search query or filter parameters above.
            </p>
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const isExpanded = expandedId === exp.id;
            const payer = houseUsers.find((u) => u.id === exp.paidBy) || USERS[exp.paidBy] || { id: exp.paidBy, name: exp.paidBy, avatar: exp.paidBy?.charAt(0) || 'U', color: '#3b82f6' };
            const pm = exp.paymentMethod;
            const cardObj = pm?.type === 'card' && pm.cardId ? cardsMap[pm.cardId] : null;
            const commentCount = exp.comments?.length || 0;

            return (
              <div key={exp.id} className="expense-item-card" onClick={() => toggleExpand(exp.id)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <UserAvatar user={payer} size={42} />

                    <div>
                      <div className="expense-title-row">
                        <span className="expense-title">{exp.title}</span>
                        <span className={`cat-pill cat-${exp.category}`}>{exp.category}</span>

                        {/* Payment Channel Badge */}
                        <span className="share-mini-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                          {pm?.type === 'card' ? (
                            <>
                              <CreditCard size={12} style={{ color: 'var(--accent-primary)' }} />
                              <span>{cardObj ? `${cardObj.bankName} (${cardObj.cardType === 'debit' ? 'Debit' : 'Credit'})` : pm.cardId ? getTranslation('deletedCardBadge', lang) : getTranslation('bankCard', lang)}</span>
                            </>
                          ) : (
                            <>
                              <Banknote size={12} style={{ color: 'var(--accent-emerald)' }} />
                              <span>{getTranslation('cash', lang)}</span>
                            </>
                          )}
                        </span>

                        {exp.receiptUrl && (
                          <span
                            className="share-mini-tag"
                            style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewReceiptUrl(exp.receiptUrl || null);
                            }}
                          >
                            <Paperclip size={12} />
                            <span>Receipt</span>
                          </span>
                        )}

                        {exp.isRecurring && (
                          <span className="share-mini-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
                            <RefreshCw size={11} />
                            <span>Recurring ({exp.recurringFrequency || 'monthly'})</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <div>Paid by <strong style={{ color: 'var(--text-primary)' }}>{payer.name}</strong></div>
                        <div>Date: <strong style={{ color: 'var(--text-primary)' }}>{exp.date}</strong></div>
                        <div>Split: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{exp.splitMethod}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: commentCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: commentCount > 0 ? 700 : 500, marginTop: '1px' }}>
                          <MessageSquare size={13} />
                          <span>{commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatCurrency(exp.amountCents, false, lang)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(exp.paidBy === myUid || isLeader) && (
                        <button
                          className="btn btn-secondary btn-icon-only"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditExpense(exp);
                          }}
                          title="Edit expense"
                        >
                          <Edit size={15} />
                        </button>
                      )}
                      {(exp.paidBy === myUid || isLeader) && (
                        <button
                          className="btn btn-danger btn-icon-only"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteExpense(exp.id);
                          }}
                          title="Delete expense"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      <div style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Pane */}
                {isExpanded && (
                  <div className="expense-expand-pane" onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                      Participant Split Breakdown ({exp.shares.length} Members)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      {exp.shares.map((share) => {
                        const user = houseUsers.find((u) => u.id === share.userId) || USERS[share.userId] || { id: share.userId, name: share.userId, avatar: share.userId?.charAt(0) || 'U', color: '#3b82f6' };
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
                              {formatCurrency(share.amountCents, false, lang)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expense Comments Section */}
                    <div style={{ backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <MessageSquare size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>In-App Housemate Comments ({commentCount})</span>
                      </div>

                      {/* Comment Stream */}
                      {exp.comments && exp.comments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                          {exp.comments.map((c) => {
                            const commenter = houseUsers.find(
                              (u) =>
                                u.id === c.userId ||
                                (u.uid && u.uid === c.userId) ||
                                u.name.toLowerCase() === c.userId.toLowerCase() ||
                                (u.email && u.email.toLowerCase() === c.userId.toLowerCase())
                            ) || USERS[c.userId] || {
                              id: c.userId,
                              name: (dbUserProfile?.uid === c.userId || activeUserId === c.userId)
                                ? (dbUserProfile?.displayName || userProfile.name)
                                : c.userId,
                              avatar: c.userId?.charAt(0) || 'U',
                              color: '#3b82f6',
                            };
                            const isMyComment = c.userId === activeUserId || c.userId === dbUserProfile?.uid || isLeader;

                            return (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                                <UserAvatar user={commenter} size={22} />
                                <div style={{ flex: 1, fontSize: '0.82rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{commenter.name}</strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                      {isMyComment && onDeleteComment && (
                                        <button
                                          type="button"
                                          style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '2px' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteComment(exp.id, c.id);
                                          }}
                                          title={getTranslation('deleteComment', lang)}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)' }}>{c.text}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                          No comments posted yet. Ask a question or leave a note below!
                        </div>
                      )}

                      {/* Add Comment Input */}
                      <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                          placeholder={getTranslation('addComment', lang)}
                          value={newCommentText[exp.id] || ''}
                          onChange={(e) => setNewCommentText({ ...newCommentText, [exp.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendComment(exp.id);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSendComment(exp.id)}
                        >
                          <Send size={14} />
                          <span>{getTranslation('postComment', lang)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Receipt Photo Modal Preview */}
      {previewReceiptUrl && (
        <div className="modal-overlay" onClick={() => setPreviewReceiptUrl(null)}>
          <div className="modal-card" style={{ maxWidth: '560px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 className="modal-title">Receipt Photo Preview</h3>
              <button className="close-btn" onClick={() => setPreviewReceiptUrl(null)}>
                <X size={18} />
              </button>
            </div>
            <img src={previewReceiptUrl} alt="Receipt" style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}
    </div>
  );
};
