import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { isFirebaseConfigured } from '../config/firebase';
import { exportBackupJSON, importBackupJSON } from '../utils/storage';
import { requestNotificationPermission, getNotificationPermissionState, isNotificationSupported } from '../utils/notifications';
import {
  LogOut,
  ShieldCheck,
  AlertCircle,
  Download,
  Upload,
  Bell,
  Database,
} from 'lucide-react';

import type { Language } from '../utils/i18n';

interface SettingsViewProps {
  lang?: Language;
}

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const {
    firebaseUser,
    dbUserProfile,
    logout,
  } = useAuth();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<NotificationPermission>(getNotificationPermissionState());

  const handleExportBackup = () => {
    const jsonStr = exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home_finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMsg('Backup JSON exported successfully!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ok = importBackupJSON(content);
      if (ok) {
        setSuccessMsg('Backup restored successfully! Reloading session...');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setErrorMsg('Invalid backup JSON format. Please select a valid Home Finance backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifState(getNotificationPermissionState());
    if (granted) {
      setSuccessMsg('Push notifications enabled for expense updates & debt reminders!');
    } else {
      setErrorMsg('Notification permission was blocked or denied by browser settings.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header with Cloud Sync Connection Status Badge */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Account & Security Settings</h1>
          <p className="page-description">
            Manage account session, security backups, push alerts, and cloud sync mode
          </p>
        </div>

        {/* Cloud Sync Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            background: isFirebaseConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${isFirebaseConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: isFirebaseConfigured ? '#10b981' : '#f59e0b',
              boxShadow: `0 0 8px ${isFirebaseConfigured ? '#10b981' : '#f59e0b'}`,
            }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isFirebaseConfigured ? '#34d399' : '#fbbf24' }}>
            {isFirebaseConfigured ? '🟢 Cloud Sync Active' : '🟡 Offline Local Storage Mode'}
          </span>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-rose)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} style={{ color: 'var(--accent-rose)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-rose)' }}>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-emerald)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={20} style={{ color: 'var(--accent-emerald)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>{successMsg}</span>
        </div>
      )}

      {/* Data Backup & Security Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>Data Backup & Security</span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              1-Click offline JSON export and restoration tool for complete data security
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
              <Download size={15} />
              <span>📥 Export Backup JSON</span>
            </button>

            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={15} />
              <span>📤 Import Backup JSON</span>
              <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} style={{ color: 'var(--accent-amber)' }} />
            <span>Push Notifications</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Browser alerts for new shared expenses and pending debt settlement reminders
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>
              Status: {notifState === 'granted' ? '🟢 Permission Granted' : notifState === 'denied' ? '🔴 Permission Denied' : '🟡 Prompt Required'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {!isNotificationSupported() ? 'Browser does not support notifications' : 'Instant alerts on household changes'}
            </div>
          </div>

          {isNotificationSupported() && notifState !== 'granted' && (
            <button className="btn btn-primary btn-sm" onClick={handleEnableNotifications}>
              <Bell size={14} />
              <span>Enable Push Alerts</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Info & Logout Card */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <UserAvatar
            user={{
              id: dbUserProfile?.uid || 'user',
              name: dbUserProfile?.displayName || 'User',
              avatar: (dbUserProfile?.displayName || 'U').slice(0, 1).toUpperCase(),
              color: '#3b82f6',
            }}
            size={42}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {dbUserProfile?.displayName || firebaseUser?.displayName || 'Active Account'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {firebaseUser?.email || dbUserProfile?.email || 'Logged in locally'}
            </div>
          </div>
        </div>

        <button className="btn btn-danger" onClick={() => logout()}>
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
};
