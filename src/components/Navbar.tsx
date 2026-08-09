import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ConfirmModal } from './ConfirmModal';
import { ThemeSwitch } from './ThemeSwitch';
import { getTranslation } from '../utils/i18n';
import type { Language } from '../utils/i18n';
import type { SyncState } from '../services/firebaseSync';
import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  Calendar,
  Sparkles,
  Wallet,
  UserCheck,
  CreditCard,
  Settings,
  Crown,
  LogOut,
  Building,
  PanelLeft,
  MoreHorizontal,
  X,
  RefreshCw,
} from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'settlement' | 'monthly' | 'personal' | 'cards' | 'house' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  lang: Language;
  expenseCount?: number;
  settlementCount?: number;
  personalCount?: number;
  cardsCount?: number;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
  syncState?: SyncState;
  onRetrySync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
  lang,
  expenseCount,
  settlementCount,
  personalCount,
  cardsCount,
  isCollapsed = false,
  toggleCollapse,
  syncState = { status: 'synced', pendingCount: 0, failedCount: 0, canRetry: false },
  onRetrySync,
}) => {
  const { userProfile, dbUserProfile, firebaseUser, currentHouse, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const logoSrc = `${import.meta.env.BASE_URL}${theme === 'dark' ? 'logo-dark.svg' : 'logo-light.svg'}`;

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('#app-favicon');
    if (favicon) favicon.href = logoSrc;

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'dark' ? '#111512' : '#F4F4F1';
  }, [logoSrc, theme]);

  const handleLogoutClick = () => {
    setIsMobileMenuOpen(false);
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = async () => {
    await logout();
  };

  const navigateMobile = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const displayName = dbUserProfile?.displayName || userProfile.name || 'User';
  const profileAvatar = dbUserProfile ? dbUserProfile.avatar : firebaseUser?.photoURL || undefined;

  const isLeader = Boolean(currentHouse?.leaderUid === (dbUserProfile?.uid || firebaseUser?.uid));

  const syncLabel = syncState.status === 'saving'
    ? 'Saving'
    : syncState.status === 'offline-queued'
      ? `Offline, queued${syncState.pendingCount > 0 ? ` (${syncState.pendingCount})` : ''}`
      : syncState.status === 'failed'
        ? 'Failed, action required'
        : syncState.status === 'auth-required' ? 'Sign in to sync' : 'Synced';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className={`brand-header ${isCollapsed ? 'is-collapsed' : ''}`}>
          {isCollapsed ? (
            toggleCollapse && (
              <button className="sidebar-collapse-btn is-collapsed" onClick={toggleCollapse} title="Open sidebar" aria-label="Open sidebar">
                <PanelLeft size={20} strokeWidth={1.8} />
              </button>
            )
          ) : (
            <>
              <div className="brand-identity">
                <div className="brand-icon" style={{ flexShrink: 0 }}>
                  <img className="brand-logo" src={logoSrc} alt="Home Finance" />
                </div>
                <div className="brand-title-box">
                  <div className="brand-title">{currentHouse?.name || t('appTitle')}</div>
                  <div className="brand-subtitle">
                    <span className="status-dot animate-pulse-glow" style={{ backgroundColor: currentHouse ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
                    <span>
                      {currentHouse
                        ? `${currentHouse.members?.length || 1} Member${(currentHouse.members?.length || 1) === 1 ? '' : 's'}`
                        : t('housematesCount')}
                    </span>
                  </div>
                </div>
              </div>
              {toggleCollapse && (
                <button className="sidebar-collapse-btn" onClick={toggleCollapse} title="Close sidebar" aria-label="Close sidebar">
                  <PanelLeft size={20} strokeWidth={1.8} />
                </button>
              )}
            </>
          )}
        </div>

        <div className={`sync-indicator sync-indicator-${syncState.status}`} title={syncState.message || syncLabel}>
          <span className="sync-indicator-dot" aria-hidden="true" />
          {!isCollapsed && <span>{syncLabel}</span>}
          {syncState.canRetry && onRetrySync && (
            <button
              type="button"
              className="sync-retry-button"
              onClick={onRetrySync}
              aria-label="Retry cloud sync"
              title="Retry cloud sync"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {/* User Account / Profile Box */}
        <div className="user-profile-card">
          <UserAvatar
            user={{
              id: dbUserProfile?.uid || userProfile.id,
              name: displayName,
              avatar: profileAvatar,
              color: userProfile.color || '#6750a4',
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
                {!isCollapsed && <span>{lang === 'en' ? 'Overview' : t('dashboard')}</span>}
              </div>
            </button>

            <button
              className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
              title={isCollapsed ? t('householdExpenses') : undefined}
            >
              <div className="nav-item-left">
                <Receipt className="nav-icon" size={18} style={{ color: '#38bdf8' }} />
                {!isCollapsed && <span>{lang === 'en' ? 'Expenses' : t('householdExpenses')}</span>}
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
                {!isCollapsed && <span>Household</span>}
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
                {!isCollapsed && <span>{lang === 'en' ? 'Personal' : t('personalWallet')}</span>}
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
                {!isCollapsed && <span>{lang === 'en' ? 'Cards' : t('paymentCards')}</span>}
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
                {!isCollapsed && <span>{lang === 'en' ? 'Reports' : t('monthlyReport')}</span>}
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
                {!isCollapsed && <span>Settings</span>}
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Toggles */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-row" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
            {!isCollapsed && (
              <div className="sidebar-footer-label">
                <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>{t('appearance')}</span>
              </div>
            )}
            <ThemeSwitch theme={theme} onToggle={toggleTheme} className={isCollapsed ? 'is-compact' : ''} />
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
      <nav className="mobile-nav" aria-label="Primary navigation">
        <button
          className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigateMobile('dashboard')}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <LayoutDashboard size={20} />
          <span>{lang === 'en' ? 'Overview' : t('dashboard')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => navigateMobile('expenses')}
          aria-current={activeTab === 'expenses' ? 'page' : undefined}
        >
          <Receipt size={20} />
          <span>{lang === 'en' ? 'Expenses' : t('householdExpenses')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
          onClick={() => navigateMobile('settlement')}
          aria-current={activeTab === 'settlement' ? 'page' : undefined}
        >
          <ArrowLeftRight size={20} />
          <span>{lang === 'en' ? 'Settle' : t('settlements')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => navigateMobile('personal')}
          aria-current={activeTab === 'personal' ? 'page' : undefined}
        >
          <Wallet size={20} />
          <span>{lang === 'en' ? 'Personal' : t('personalWallet')}</span>
        </button>

        <button
          className={`mobile-nav-item ${['monthly', 'cards', 'house', 'settings'].includes(activeTab) ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(true)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-more-menu"
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <section
            id="mobile-more-menu"
            className="mobile-menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-handle" />
            <div className="mobile-menu-header">
              <div className="mobile-menu-profile">
                <UserAvatar
                  user={{
                    id: dbUserProfile?.uid || userProfile.id,
                    name: displayName,
                    avatar: profileAvatar,
                    color: userProfile.color || '#0a84ff',
                  }}
                  size={42}
                />
                <div>
                  <strong>{displayName}</strong>
                  <span>{currentHouse?.name || 'Personal workspace'}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>

            <div className="mobile-menu-grid">
              {[
                { tab: 'cards' as const, label: lang === 'en' ? 'Cards' : t('paymentCards'), icon: CreditCard, count: cardsCount },
                { tab: 'monthly' as const, label: lang === 'en' ? 'Reports' : t('monthlyReport'), icon: Calendar },
                { tab: 'house' as const, label: 'Household', icon: Building },
                { tab: 'settings' as const, label: 'Settings', icon: Settings },
              ].map(({ tab, label, icon: Icon, count }) => (
                <button
                  key={tab}
                  className={`mobile-menu-item ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => navigateMobile(tab)}
                >
                  <span className="mobile-menu-icon"><Icon size={20} /></span>
                  <span>{label}</span>
                  {count !== undefined && count > 0 && <small>{count}</small>}
                </button>
              ))}
            </div>

            <div className="mobile-menu-actions">
              <ThemeSwitch theme={theme} onToggle={toggleTheme} />
              <button className="danger" onClick={handleLogoutClick}><LogOut size={17} /> Log out</button>
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Log out of Home Finance?"
        message="You will return to the sign-in screen. Your household data and saved records will remain safe."
        confirmText="Log out"
        variant="primary"
        onConfirm={handleConfirmLogout}
        onClose={() => setIsLogoutConfirmOpen(false)}
      />
    </>
  );
};
