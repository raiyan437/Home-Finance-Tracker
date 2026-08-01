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
  ChevronLeft,
  ChevronRight,
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
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
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
  isCollapsed = false,
  toggleCollapse,
}) => {
  const { userProfile, dbUserProfile, firebaseUser, currentHouse, logout } = useAuth();
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang);

  const handleLogoutClick = async () => {
    await logout();
  };

  const displayName = dbUserProfile?.displayName || userProfile.name || 'User';

  const isLeader = Boolean(
    dbUserProfile?.role === 'leader' ||
    (currentHouse && currentHouse.leaderUid && (currentHouse.leaderUid === dbUserProfile?.uid || currentHouse.leaderUid === firebaseUser?.uid))
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="brand-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', width: '100%' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', cursor: isCollapsed ? 'pointer' : 'default' }}
              onClick={isCollapsed ? toggleCollapse : undefined}
              title={isCollapsed ? 'Expand Sidebar' : undefined}
            >
              <div className="brand-icon" style={{ flexShrink: 0 }}>
                <Home size={22} />
              </div>
              {!isCollapsed && (
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
              )}
            </div>

            {!isCollapsed && toggleCollapse && (
              <button
                className="btn btn-secondary btn-icon"
                style={{ padding: '6px', minWidth: '30px', height: '30px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                onClick={toggleCollapse}
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {isCollapsed && toggleCollapse && (
            <button
              className="btn btn-secondary btn-icon"
              style={{ width: '100%', padding: '4px', height: '26px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={toggleCollapse}
              title="Expand Sidebar"
            >
              <ChevronRight size={15} />
            </button>
          )}
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
          {!isCollapsed && (
            <div className="user-profile-info" style={{ flex: 1 }}>
              <div className="user-name-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="user-name">{displayName}</span>
                {isLeader && (
                  <span title="House Leader 👑" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Crown size={14} style={{ color: 'var(--accent-amber)', filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.4))', flexShrink: 0 }} />
                  </span>
                )}
              </div>
              <span className="user-role-badge">
                <UserCheck size={11} />
                <span>{isLeader ? 'Leader' : 'Member'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className="nav-container">
          {/* Section 1: Household */}
          {!isCollapsed && <div className="nav-section-title">Household Shared</div>}
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              title={isCollapsed ? t('dashboard') : undefined}
            >
              <div className="nav-item-left">
                <LayoutDashboard className="nav-icon" size={18} style={{ color: 'var(--accent-primary)' }} />
                {!isCollapsed && <span>{t('dashboard')}</span>}
              </div>
            </button>

            <button
              className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
              title={isCollapsed ? t('householdExpenses') : undefined}
            >
              <div className="nav-item-left">
                <Receipt className="nav-icon" size={18} style={{ color: '#38bdf8' }} />
                {!isCollapsed && <span>{t('householdExpenses')}</span>}
              </div>
              {!isCollapsed && expenseCount !== undefined && expenseCount > 0 && (
                <span className="nav-badge">{expenseCount}</span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
              onClick={() => setActiveTab('settlement')}
              title={isCollapsed ? t('settlements') : undefined}
            >
              <div className="nav-item-left">
                <ArrowLeftRight className="nav-icon" size={18} style={{ color: 'var(--accent-emerald)' }} />
                {!isCollapsed && <span>{t('settlements')}</span>}
              </div>
              {!isCollapsed && settlementCount !== undefined && settlementCount > 0 && (
                <span className="nav-badge nav-badge-emerald">
                  {settlementCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'house' ? 'active' : ''}`}
              onClick={() => setActiveTab('house')}
              title={isCollapsed ? 'House Management' : undefined}
            >
              <div className="nav-item-left">
                <Building className="nav-icon" size={18} style={{ color: '#10b981' }} />
                {!isCollapsed && <span>House Management</span>}
              </div>
            </button>
          </nav>

          {/* Section 2: Personal & Wallet */}
          {!isCollapsed && <div className="nav-section-title">Personal Wallet & Cards</div>}
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
              title={isCollapsed ? t('personalWallet') : undefined}
            >
              <div className="nav-item-left">
                <Wallet className="nav-icon" size={18} style={{ color: 'var(--accent-amber)' }} />
                {!isCollapsed && <span>{t('personalWallet')}</span>}
              </div>
              {!isCollapsed && personalCount !== undefined && personalCount > 0 && (
                <span className="nav-badge nav-badge-amber">
                  {personalCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'cards' ? 'active' : ''}`}
              onClick={() => setActiveTab('cards')}
              title={isCollapsed ? t('paymentCards') : undefined}
            >
              <div className="nav-item-left">
                <CreditCard className="nav-icon" size={18} style={{ color: 'var(--accent-cyan)' }} />
                {!isCollapsed && <span>{t('paymentCards')}</span>}
              </div>
              {!isCollapsed && cardsCount !== undefined && cardsCount > 0 && (
                <span className="nav-badge nav-badge-cyan">
                  {cardsCount}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
              title={isCollapsed ? t('monthlyReport') : undefined}
            >
              <div className="nav-item-left">
                <Calendar className="nav-icon" size={18} style={{ color: '#a855f7' }} />
                {!isCollapsed && <span>{t('monthlyReport')}</span>}
              </div>
            </button>
          </nav>

          {/* Section 3: Preferences */}
          {!isCollapsed && <div className="nav-section-title">Preferences</div>}
          <nav className="nav-list">
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              title={isCollapsed ? 'Settings & Account' : undefined}
            >
              <div className="nav-item-left">
                <Settings className="nav-icon" size={18} style={{ color: '#ec4899' }} />
                {!isCollapsed && <span>Settings & Account</span>}
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Toggles */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-row" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
            {!isCollapsed && (
              <div className="sidebar-footer-label">
                <Languages size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span>Language</span>
              </div>
            )}
            <button className="theme-toggle-btn" onClick={toggleLang} title={isCollapsed ? 'Switch English / Bangla' : 'Switch English / Bangla'}>
              <span>{lang === 'en' ? '🇧🇩' : '🇬🇧'}</span>
              {!isCollapsed && <span>{lang === 'en' ? ' বাংলা' : ' EN'}</span>}
            </button>
          </div>

          <div className="sidebar-footer-row" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
            {!isCollapsed && (
              <div className="sidebar-footer-label">
                <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>{t('appearance')}</span>
              </div>
            )}
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? t('light') : t('dark')}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {!isCollapsed && <span>{theme === 'dark' ? t('light') : t('dark')}</span>}
            </button>
          </div>

          <button
            className="sidebar-logout-btn"
            onClick={handleLogoutClick}
            title={isCollapsed ? 'Log Out' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          >
            <LogOut size={15} />
            {!isCollapsed && <span>Log Out</span>}
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
