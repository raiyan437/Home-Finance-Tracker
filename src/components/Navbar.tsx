import React from 'react';
import { LayoutDashboard, Receipt, ArrowLeftRight, Calendar, Plus, Sun, Moon, Home, Sparkles } from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'settlement' | 'monthly';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenAddExpense: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  expenseCount?: number;
  settlementCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddExpense,
  theme,
  toggleTheme,
  expenseCount,
  settlementCount,
}) => {
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
              <span>3 Household Members</span>
            </div>
          </div>
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
              <span>Expenses</span>
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
              <span className="nav-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)' }}>
                {settlementCount}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            <div className="nav-item-left">
              <Calendar size={19} />
              <span>Monthly Overview</span>
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
          className={`mobile-nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlement')}
        >
          <ArrowLeftRight size={20} />
          <span>Settle</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          <Calendar size={20} />
          <span>Monthly</span>
        </button>
      </nav>
    </>
  );
};
