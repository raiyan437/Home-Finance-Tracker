import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { isFirebaseConfigured } from '../config/firebase';
import { exportBackupJSON, importBackupJSON } from '../services/storage';
import { requestNotificationPermission, getNotificationPermissionState, isNotificationSupported } from '../utils/notifications';
import { saveAttachment } from '../services/attachments';
import { syncSaveCard, syncSaveExpense, syncSaveSettlement } from '../services/firebaseSync';
import {
  LogOut,
  ShieldCheck,
  AlertCircle,
  Download,
  Upload,
  Bell,
  Database,
  Camera,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

import type { Language } from '../utils/i18n';

interface SettingsViewProps {
  lang?: Language;
}

export const SettingsPage: React.FC<SettingsViewProps> = () => {
  const {
    firebaseUser,
    dbUserProfile,
    currentHouse,
    updateUserProfilePhoto,
    changeUserPassword,
    logout,
  } = useAuth();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<NotificationPermission>(getNotificationPermissionState());
  const cloudConnected = isFirebaseConfigured && Boolean(firebaseUser);

  // Password Change Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password Visibility States
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be 5MB or smaller.');
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const photoUrl = await saveAttachment(file, 'avatars');
      await updateUserProfilePhoto(photoUrl);
      setSuccessMsg('Profile photo updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setIsChangingPass(true);

    try {
      await changeUserPassword(currentPassword, newPassword);
      setSuccessMsg('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportBackupJSON(currentHouse?.id, dbUserProfile?.uid);
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
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const result = importBackupJSON(content, currentHouse?.id, dbUserProfile?.uid);
      if (result.ok && result.data) {
        const writes = [
          ...result.data.expenses.map((expense) => syncSaveExpense(expense, expense.scope === 'personal' ? undefined : currentHouse?.id)),
          ...result.data.settlements.map((settlement) => syncSaveSettlement(settlement, currentHouse?.id)),
          ...result.data.cards.map((card) => syncSaveCard(card)),
        ];
        const syncResults = await Promise.all(writes);
        const queued = syncResults.some((item) => item?.queued);
        setSuccessMsg(queued ? 'Backup restored locally; cloud updates are queued for retry.' : 'Backup restored locally and to the cloud. Reloading session...');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setErrorMsg(result.error || 'Invalid Home Finance backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifState(getNotificationPermissionState());
    if (granted) {
      setSuccessMsg('Foreground browser notifications enabled.');
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
            Manage profile photo, change password, security backups, browser alerts, and cloud sync mode
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
            background: cloudConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${cloudConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: cloudConnected ? '#10b981' : '#f59e0b',
              boxShadow: `0 0 8px ${cloudConnected ? '#10b981' : '#f59e0b'}`,
            }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: cloudConnected ? '#34d399' : '#fbbf24' }}>
            {cloudConnected ? 'Cloud account connected' : isFirebaseConfigured ? 'Cloud configured — sign in required' : 'Offline local storage mode'}
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

      {/* SECTION 1: PROFILE AVATAR PHOTO UPLOAD */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <UserAvatar
              user={{
                id: dbUserProfile?.uid || 'user',
                name: dbUserProfile?.displayName || 'User',
                avatar: dbUserProfile?.avatar || firebaseUser?.photoURL || undefined,
                color: '#3b82f6',
              }}
              size={72}
            />

            <label
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
              title="Upload Profile Picture"
            >
              <Camera size={15} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={isUploadingPhoto} />
            </label>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '4px' }}>
              {dbUserProfile?.displayName || firebaseUser?.displayName || 'User Profile'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {firebaseUser?.email || dbUserProfile?.email || 'Logged in account'}
            </p>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex' }}>
              <Camera size={14} />
              <span>{isUploadingPhoto ? 'Uploading...' : 'Change Profile Picture'}</span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={isUploadingPhoto} />
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHANGE ACCOUNT PASSWORD FORM */}
      <div className="glass-card">
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Change Account Password</span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Update your login password after current password verification
          </p>
        </div>

        <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '440px' }}>
          {/* Current Password Field */}
          <div>
            <label className="form-label">Current Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showCurrentPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ paddingRight: '42px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                title={showCurrentPass ? 'Hide Password' : 'Show Password'}
              >
                {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div>
            <label className="form-label">New Password (Min 6 Characters)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showNewPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: '42px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                title={showNewPass ? 'Hide Password' : 'Show Password'}
              >
                {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password Field */}
          <div>
            <label className="form-label">Confirm New Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showConfirmPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={{ paddingRight: '42px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                title={showConfirmPass ? 'Hide Password' : 'Show Password'}
              >
                {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={isChangingPass || !currentPassword || !newPassword || !confirmNewPassword}>
            <KeyRound size={16} />
            <span>{isChangingPass ? 'Updating Password...' : 'Update Password'}</span>
          </button>
        </form>
      </div>

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
            <span>Browser Notifications</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Foreground alerts while this app is open; background push is not enabled
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
              <span>Enable Browser Alerts</span>
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
              avatar: dbUserProfile?.avatar || (dbUserProfile?.displayName || 'U').slice(0, 1).toUpperCase(),
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
