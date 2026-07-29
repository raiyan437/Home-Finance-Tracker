import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { getTranslation } from '../utils/i18n';
import type { Language } from '../utils/i18n';
import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  Calendar,
  Plus,
  Sun,
  Moon,
  Home,
  Sparkles,
  Wallet,
  UserCheck,
  CreditCard,
  Languages,
  Settings,
  Crown,
  LogOut,
} from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'settlement' | 'monthly' | 'personal' | 'cards' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenAddExpense: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  lang: Language;
  toggleLang: () => void;
  expenseCount?: number;
  settlementCount?: number;
  personalCount?: number;
  cardsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddExpense,
  theme,
  toggleTheme,
  lang,
  toggleLang,
  expenseCount,
  settlementCount,
  personalCount,
  cardsCount,
}) => {
  const { userProfile, dbUserProfile, currentHouse, logout } = useAuth();
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang);

  const handleLogoutClick = async () => {
    await logout();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-icon">
            <Home size={22} />
          </div>
          <div className="brand-title-box">
            <div className="brand-title">{currentHouse?.name || t('appTitle')}</div>
            <div className="brand-subtitle">
              <span className="status-dot" />
              <span>{currentHouse ? `Code: ${currentHouse.code}` : t('housematesCount')}</span>
            </div>
          </div>
        </div>

        {/* User Account / Profile Box (Clean non-modal profile card) */}
        <div className="user-profile-card" style={{ cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <UserAvatar
              user={{
                id: userProfile.id,
                name: dbUserProfile?.displayName || userProfile.name,
                avatar: userProfile.avatar,
                color: userProfile.color,
              }}
              size={40}
            />
            <div className="user-profile-info" style={{ flex: 1 }}>
              <div className="user-name-row">
                <span className="user-name">{dbUserProfile?.displayName || userProfile.name}</span>
                {dbUserProfile?.role === 'leader' && (
                  <Crown size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                )}
              </div>
              <span className="user-role-badge">
                <UserCheck size={12} />
                <span>{dbUserProfile?.role === 'leader' ? 'Leader' : 'Active Account'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="nav-list">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="nav-item-left">
              <LayoutDashboard size={19} />
              <span>{t('dashboard')}</span>
            </div>
          </button>

          <button
            className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            <div className="nav-item-left">
              <Receipt size={19} />
              <span>{t('householdExpenses')}</span>
            </div>
            {expenseCount !== undefined && expenseCount > 0 && (
              <span className="nav-badge">{expenseCount}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
            onClick={() => setActiveTab('settlement')}
          >
            <div className="nav-item-left">
              <ArrowLeftRight size={19} />
              <span>{t('settlements')}</span>
            </div>
            {settlementCount !== undefined && settlementCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)' }}>
                {settlementCount}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            <div className="nav-item-left">
              <Wallet size={19} style={{ color: 'var(--accent-amber)' }} />
              <span>{t('personalWallet')}</span>
            </div>
            {personalCount !== undefined && personalCount > 0 && (
              <span className="nav-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)' }}>
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
              <span>{t('paymentCards')}</span>
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
              <span>{t('monthlyReport')}</span>
            </div>
          </button>

          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <div className="nav-item-left">
              <Settings size={19} style={{ color: 'var(--accent-purple)' }} />
              <span>Settings ⚙️</span>
            </div>
          </button>
        </nav>

        <button className="add-expense-btn-sidebar" onClick={onOpenAddExpense}>
          <Plus size={20} />
          <span>{t('newExpense')}</span>
        </button>

        {/* Footer Toggles (Language, Theme & Log Out) */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Languages size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Language</span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleLang} title="Switch English / Bangla">
              <span>{lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 EN'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('appearance')}</span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === 'dark' ? t('light') : t('dark')}</span>
            </button>
          </div>

          {/* Clean Log Out Button */}
          <button
            className="btn btn-danger"
            style={{ width: '100%', marginTop: '6px', justifyContent: 'center', fontWeight: 800, padding: '10px' }}
            onClick={handleLogoutClick}
          >
            <LogOut size={16} />
            <span>Log Out</span>
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
          <span>{t('dashboard')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <Receipt size={20} />
          <span>{t('householdExpenses')}</span>
        </button>

        <button className="mobile-add-fab" onClick={onOpenAddExpense} title="Add Expense">
          <Plus size={26} />
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          <CreditCard size={20} />
          <span>{t('paymentCards')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </>
  );
};
