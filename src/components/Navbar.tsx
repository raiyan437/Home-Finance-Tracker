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
  Building,
} from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'settlement' | 'monthly' | 'personal' | 'cards' | 'house' | 'settings';

export type AccentColor = 'charcoal' | 'midnight' | 'emerald' | 'amber';

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
  const { userProfile, dbUserProfile, firebaseUser, currentHouse, logout } = useAuth();
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang);

  const handleLogoutClick = async () => {
    await logout();
  };

  const displayName = dbUserProfile?.displayName || userProfile.name || 'User';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="brand-header">
          <div className="brand-icon">
            <Home size={22} />
          </div>
          <div className="brand-title-box">
            <div className="brand-title">{currentHouse?.name || t('appTitle')}</div>
            <div className="brand-subtitle">
              <span className="status-dot animate-pulse-glow" style={{ backgroundColor: currentHouse ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
              <span>
                {currentHouse
                  ? `${currentHouse.members?.length || 1} Member${(currentHouse.members?.length || 1) === 1 ? '' : 's'} • ${currentHouse.code}`
                  : t('housematesCount')}
              </span>
            </div>
          </div>
        </div>

        {/* User Account / Profile Box */}
        <div className="user-profile-card">
          <UserAvatar
            user={{
              id: dbUserProfile?.uid || userProfile.id,
              name: displayName,
              avatar:
                dbUserProfile?.avatar && (dbUserProfile.avatar.startsWith('data:') || dbUserProfile.avatar.startsWith('http'))
                  ? dbUserProfile.avatar
                  : firebaseUser?.photoURL && firebaseUser.photoURL.startsWith('http')
                  ? firebaseUser.photoURL
                  : undefined,
              color: userProfile.color || '#3b82f6',
            }}
            size={38}
          />
          <div className="user-profile-info" style={{ flex: 1 }}>
            <div className="user-name-row">
              <span className="user-name">{displayName}</span>
              {dbUserProfile?.role === 'leader' && (
                <Crown size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              )}
            </div>
            <span className="user-role-badge">
              <UserCheck size={11} />
              <span>{dbUserProfile?.role === 'leader' ? 'Leader' : 'Member'}</span>
            </span>
          </div>
        </div>

        {/* Quick Add Expense CTA Button */}
        <button className="sidebar-quick-add-btn" onClick={onOpenAddExpense}>
          <Plus size={18} />
          <span>{t('addExpense')}</span>
        </button>

        {/* Navigation Section */}
        <div className="nav-container">
          {/* Section 1: Household */}
          <div className="nav-section-title">Household Shared</div>
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="nav-item-left">
                <LayoutDashboard className="nav-icon" size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>{t('dashboard')}</span>
              </div>
            </button>

            <button
              className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <div className="nav-item-left">
                <Receipt className="nav-icon" size={18} style={{ color: '#38bdf8' }} />
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
                <ArrowLeftRight className="nav-icon" size={18} style={{ color: 'var(--accent-emerald)' }} />
                <span>{t('settlements')}</span>
              </div>
              {settlementCount !== undefined && settlementCount > 0 && (
                <span className="nav-badge nav-badge-emerald">
                  {settlementCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'house' ? 'active' : ''}`}
              onClick={() => setActiveTab('house')}
            >
              <div className="nav-item-left">
                <Building className="nav-icon" size={18} style={{ color: '#10b981' }} />
                <span>House Management</span>
              </div>
            </button>
          </nav>

          {/* Section 2: Personal & Wallet */}
          <div className="nav-section-title">Personal Wallet & Cards</div>
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <div className="nav-item-left">
                <Wallet className="nav-icon" size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>{t('personalWallet')}</span>
              </div>
              {personalCount !== undefined && personalCount > 0 && (
                <span className="nav-badge nav-badge-amber">
                  {personalCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'cards' ? 'active' : ''}`}
              onClick={() => setActiveTab('cards')}
            >
              <div className="nav-item-left">
                <CreditCard className="nav-icon" size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>{t('paymentCards')}</span>
              </div>
              {cardsCount !== undefined && cardsCount > 0 && (
                <span className="nav-badge nav-badge-cyan">
                  {cardsCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              <div className="nav-item-left">
                <Calendar className="nav-icon" size={18} style={{ color: '#a855f7' }} />
                <span>{t('monthlyReport')}</span>
              </div>
            </button>
          </nav>

          {/* Section 3: Preferences */}
          <div className="nav-section-title">Preferences</div>
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <div className="nav-item-left">
                <Settings className="nav-icon" size={18} style={{ color: '#ec4899' }} />
                <span>Settings & Account</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Toggles */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <div className="sidebar-footer-label">
              <Languages size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span>Language</span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleLang} title="Switch English / Bangla">
              <span>{lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 EN'}</span>
            </button>
          </div>

          <div className="sidebar-footer-row">
            <div className="sidebar-footer-label">
              <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
              <span>{t('appearance')}</span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? t('light') : t('dark')}</span>
            </button>
          </div>

          <button
            className="sidebar-logout-btn"
            onClick={handleLogoutClick}
          >
            <LogOut size={15} />
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
          className={`mobile-nav-item ${activeTab === 'house' ? 'active' : ''}`}
          onClick={() => setActiveTab('house')}
        >
          <Building size={20} />
          <span>House</span>
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
