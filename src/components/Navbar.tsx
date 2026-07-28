import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { LayoutDashboard, Receipt, ArrowLeftRight, Calendar, Plus, Sun, Moon, Home, Sparkles, Wallet, UserCheck, CreditCard } from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'settlement' | 'monthly' | 'personal' | 'cards';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenAddExpense: () => void;
  onOpenAuthModal: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  expenseCount?: number;
  settlementCount?: number;
  personalCount?: number;
  cardsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddExpense,
  onOpenAuthModal,
  theme,
  toggleTheme,
  expenseCount,
  settlementCount,
  personalCount,
  cardsCount,
}) => {
  const { userProfile } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-icon">
            <Home size={22} />
          </div>
          <div className="brand-title-box">
            <div className="brand-title">Home Finance</div>
            <div className="brand-subtitle">
              <span className="status-dot" />
              <span>3 Housemates</span>
            </div>
          </div>
        </div>

        {/* User Account / Profile Box */}
        <div
          onClick={onOpenAuthModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to switch profile or manage Firebase auth"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserAvatar user={userProfile} size={32} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{userProfile.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 700 }}>Active Profile</div>
            </div>
          </div>
          <UserCheck size={16} style={{ color: 'var(--text-muted)' }} />
        </div>

        <nav className="nav-links">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="nav-item-left">
              <LayoutDashboard size={19} />
              <span>Dashboard</span>
            </div>
          </button>

          <button
            className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            <div className="nav-item-left">
              <Receipt size={19} />
              <span>Household Expenses</span>
            </div>
            {expenseCount !== undefined && <span className="nav-badge">{expenseCount}</span>}
          </button>

          <button
            className={`nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
            onClick={() => setActiveTab('settlement')}
          >
            <div className="nav-item-left">
              <ArrowLeftRight size={19} />
              <span>Settlements</span>
            </div>
            {settlementCount !== undefined && settlementCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)' }}>
                {settlementCount}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            <div className="nav-item-left">
              <Wallet size={19} style={{ color: 'var(--accent-purple)' }} />
              <span>Personal Wallet</span>
            </div>
            {personalCount !== undefined && personalCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-purple)' }}>
                {personalCount}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <div className="nav-item-left">
              <CreditCard size={19} style={{ color: 'var(--accent-cyan)' }} />
              <span>Payment Cards</span>
            </div>
            {cardsCount !== undefined && cardsCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)' }}>
                {cardsCount}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            <div className="nav-item-left">
              <Calendar size={19} />
              <span>Monthly Report</span>
            </div>
          </button>
        </nav>

        <button className="add-expense-btn-sidebar" onClick={onOpenAddExpense}>
          <Plus size={20} />
          <span>New Expense</span>
        </button>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Appearance</span>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Bar */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <Receipt size={20} />
          <span>Expenses</span>
        </button>

        <button className="mobile-add-fab" onClick={onOpenAddExpense} title="Add Expense">
          <Plus size={26} />
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          <CreditCard size={20} />
          <span>Cards</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <Wallet size={20} />
          <span>Wallet</span>
        </button>
      </nav>
    </>
  );
};
