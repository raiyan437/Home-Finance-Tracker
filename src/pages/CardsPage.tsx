import React, { useState, useEffect, useMemo } from 'react';
import type { PaymentCard, Expense } from '../types';
import { useAuth } from '../context/AuthContext';
import { USERS, getHouseUsers } from '../features/settlementEngine';
import { formatCurrency } from '../utils/currency';
import { UserAvatar } from '../components/UserAvatar';
import { ConfirmModal } from '../components/ConfirmModal';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { CreditCard, Plus, Trash2, Edit, X, ShieldCheck, Wallet, Landmark } from 'lucide-react';

interface CardsManagerProps {
  cards: PaymentCard[];
  expenses: Expense[];
  onAddCard: (card: Omit<PaymentCard, 'id' | 'createdAt'>, editingId?: string) => void;
  onDeleteCard: (cardId: string) => void;
  lang?: Language;
}

const CARD_COLOR_PRESETS = [
  { name: 'Midnight Blue', value: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' },
  { name: 'Emerald Green', value: 'linear-gradient(135deg, #065f46, #10b981)' },
  { name: 'Violet Glow', value: 'linear-gradient(135deg, #5b21b6, #8b5cf6)' },
  { name: 'Solar Yellow', value: 'linear-gradient(135deg, #d97706, #eab308, #fde047)' },
  { name: 'Sunset Amber', value: 'linear-gradient(135deg, #b45309, #f59e0b)' },
  { name: 'Neon Cyan', value: 'linear-gradient(135deg, #0e7490, #06b6d4)' },
  { name: 'Rose Red', value: 'linear-gradient(135deg, #be123c, #f43f5e)' },
  { name: 'Obsidian Dark', value: 'linear-gradient(135deg, #0f172a, #334155)' },
  { name: 'Gold Bronze', value: 'linear-gradient(135deg, #854d0e, #ca8a04)' },
];

export const CardsPage: React.FC<CardsManagerProps> = ({
  cards,
  expenses,
  onAddCard,
  onDeleteCard,
  lang = 'en',
}) => {
  const { userProfile, activeUserId, dbUserProfile, currentHouse } = useAuth();
  const houseUsers = useMemo(() => getHouseUsers(currentHouse, dbUserProfile), [currentHouse, dbUserProfile]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PaymentCard | null>(null);
  const [deletingCard, setDeletingCard] = useState<PaymentCard | null>(null);
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [selectedColor, setSelectedColor] = useState(CARD_COLOR_PRESETS[0].value);

  const getCardOwner = (cardOwnerId?: string) => {
    const targetId = cardOwnerId || dbUserProfile?.uid || activeUserId;
    const found = houseUsers.find((user) => user.id === targetId || user.uid === targetId);
    if (found) return found;
    if (USERS[targetId]) return USERS[targetId];

    const fallbackName = dbUserProfile?.displayName || userProfile?.name || 'User';
    return {
      id: targetId || 'owner',
      name: fallbackName,
      avatar: dbUserProfile?.avatar || userProfile?.avatar,
      color: '#3b82f6',
    };
  };

  // Background body scroll lock when modal is active
  useEffect(() => {
    if (isModalOpen || deletingCard) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, deletingCard]);

  // Enforce strict card ownership filtering per member (prevent card leakage)
  const userCards = useMemo(() => {
    const myUid = dbUserProfile?.uid || activeUserId;
    return cards.filter((card) => card.ownerId === myUid);
  }, [cards, activeUserId, dbUserProfile?.uid]);

  // Calculate spent total per card
  const cardSpentTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.paymentMethod?.type === 'card' && e.paymentMethod.cardId) {
        const id = e.paymentMethod.cardId;
        totals[id] = (totals[id] || 0) + e.amountCents;
      }
    });
    return totals;
  }, [expenses]);

  const handleOpenAdd = (card?: PaymentCard) => {
    if (card) {
      setEditingCard(card);
      setBankName(card.bankName);
      setCardType(card.cardType || 'credit');
      setSelectedColor(card.color);
    } else {
      setEditingCard(null);
      setBankName('');
      setCardType('credit');
      setSelectedColor(CARD_COLOR_PRESETS[0].value);
    }
    setIsModalOpen(true);
  };

  const handleDeleteClick = (card: PaymentCard) => {
    const linkedCount = expenses.filter(
      (e) => e.paymentMethod?.type === 'card' && e.paymentMethod.cardId === card.id
    ).length;

    if (linkedCount > 0) {
      setDeletingCard(card);
    } else {
      onDeleteCard(card.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) return;

    onAddCard(
      {
        bankName: bankName.trim(),
        cardType,
        color: selectedColor,
        ownerId: dbUserProfile?.uid || activeUserId,
        houseId: currentHouse?.id,
      },
      editingCard ? editingCard.id : undefined
    );

    setIsModalOpen(false);
  };

  const activeUserName = dbUserProfile?.displayName || userProfile?.name || 'My';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CreditCard size={28} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h1 className="page-title">{getTranslation('paymentCards', lang)}</h1>
              <p className="page-description">
                Manage bank credit/debit cards to track payment channels for household & personal outlays
              </p>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
          <Plus size={18} />
          <span>Add New Card</span>
        </button>
      </div>

      {/* Cards Deck Grid */}
      <div>
        <div className="housemates-section-title">
          <Wallet size={20} style={{ color: 'var(--accent-primary)' }} />
          <span>{activeUserName}'s Active Cards ({userCards.length})</span>
        </div>

        {userCards.length === 0 ? (
          <div className="glass-card empty-state">
            <CreditCard className="empty-icon" />
            <div className="empty-title">No Payment Cards Added</div>
            <p style={{ fontSize: '0.85rem' }}>Add your bank card to select it when logging expenses.</p>
            <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
              <Plus size={16} /> Add First Card
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 360px))', gap: '20px' }}>
            {userCards.map((card) => {
              const spentCents = cardSpentTotals[card.id] || 0;
              const owner = getCardOwner(card.ownerId);
              const cardTypeLabel = card.cardType === 'debit' ? 'DEBIT CARD' : 'CREDIT CARD';

              return (
                <div
                  key={card.id}
                  className="animate-fade-in"
                  style={{
                    background: card.color,
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    color: 'white',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '190px',
                    maxWidth: '360px',
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {/* Subtle Card Chip & Logo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
                          boxShadow: 'inset 0 0 4px rgba(0,0,0,0.3)',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.85, letterSpacing: '0.06em' }}>
                        {cardTypeLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white' }}
                        onClick={() => handleOpenAdd(card)}
                        title="Edit card"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        style={{ background: 'rgba(244, 63, 94, 0.3)', border: 'none', color: 'white' }}
                        onClick={() => handleDeleteClick(card)}
                        title="Delete card"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div style={{ margin: '14px 0' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                      {card.bankName}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserAvatar user={owner} size={20} />
                      <span>{owner.name}'s Card</span>
                    </div>
                  </div>

                  {/* Card Footer Spent Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
                        Total Tracked Outlay
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                        {formatCurrency(spentCents, false, lang)}
                      </div>
                    </div>

                    <ShieldCheck size={22} style={{ opacity: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Card Confirmation Notice Modal */}
      <ConfirmModal
        isOpen={!!deletingCard}
        title={getTranslation('confirmDeleteCard', lang)}
        message={
          deletingCard
            ? `Card "${deletingCard.bankName}" is linked to ${
                expenses.filter((e) => e.paymentMethod?.type === 'card' && e.paymentMethod.cardId === deletingCard.id).length
              } expense record(s). Deleting it will mark historical transaction badges as (Deleted Card). Proceed?`
            : ''
        }
        confirmText="Delete Card"
        variant="danger"
        onConfirm={() => {
          if (deletingCard) {
            onDeleteCard(deletingCard.id);
            setDeletingCard(null);
          }
        }}
        onClose={() => setDeletingCard(null)}
      />

      {/* Add / Edit Card Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <CreditCard size={22} style={{ color: 'var(--accent-primary)' }} />
                <h2 className="modal-title">{editingCard ? 'Edit Payment Card' : 'Add New Payment Card'}</h2>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-group">
                <label className="form-label">Bank Name / Card Label</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Standard Chartered, Chase Visa, Amex"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Card Type Selector (Credit Card vs Debit Card) */}
              <div className="form-group">
                <label className="form-label">Card Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${cardType === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                    onClick={() => setCardType('credit')}
                  >
                    <CreditCard size={16} />
                    <span>Credit Card</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${cardType === 'debit' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                    onClick={() => setCardType('debit')}
                  >
                    <Landmark size={16} />
                    <span>Debit Card</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Card Theme Gradient</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '10px', marginTop: '6px' }}>
                  {CARD_COLOR_PRESETS.map((preset) => {
                    const isSelected = selectedColor === preset.value;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        style={{
                          background: preset.value,
                          height: '48px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '3px solid white' : '1px solid transparent',
                          boxShadow: isSelected ? '0 0 14px rgba(255,255,255,0.6)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => setSelectedColor(preset.value)}
                        title={preset.name}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Live Card Preview
                </div>
                <div
                  style={{
                    background: selectedColor,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 800,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{bankName.trim() || 'Bank Name'}</span>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '4px' }}>
                    {cardType === 'credit' ? 'CREDIT CARD' : 'DEBIT CARD'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCard ? 'Save Changes' : 'Save Payment Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
