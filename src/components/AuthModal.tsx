import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ALL_USERS } from '../features/settlementEngine';
import type { UserId } from '../types';
import { UserAvatar } from './UserAvatar';
import { X, Lock, User, KeyRound, ShieldCheck, Check, AlertCircle, LogOut } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    activeUserId,
    switchProfile,
    firebaseUser,
    dbUserProfile,
    loginWithEmail,
    signUpWithEmail,
    logout,
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'firebase'>('profile');
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedHousemate, setSelectedHousemate] = useState<UserId>('raiyan');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectProfile = (userId: UserId) => {
    switchProfile(userId);
    onClose();
  };

  const handleFirebaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          setErrorMsg('Please enter a display name.');
          setIsSubmitting(false);
          return;
        }
        await signUpWithEmail(email, password, displayName);
        switchProfile(selectedHousemate);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Lock size={22} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="modal-title">Account & Authentication</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>Switch Profile</span>
          </button>
          <button
            className={`btn ${activeTab === 'firebase' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('firebase')}
          >
            <KeyRound size={15} />
            <span>Firebase Login / Sign Up</span>
          </button>
        </div>



        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Select your active housemate profile for local tracking and expense attribution:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ALL_USERS.map((user) => {
                const isActive = activeUserId === user.id;
                return (
                  <button
                    key={user.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: isActive ? 'var(--md-sys-color-primary-container)' : 'var(--bg-input)',
                    }}
                    onClick={() => handleSelectProfile(user.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <UserAvatar user={user} size={38} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{user.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Household Member</div>
                      </div>
                    </div>

                    {isActive && (
                      <span className="badge badge-positive">
                        <Check size={14} /> Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'firebase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {firebaseUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-input)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={24} style={{ color: 'var(--accent-emerald)' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{dbUserProfile?.displayName || firebaseUser.displayName || 'Authenticated User'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{firebaseUser.email}</div>
                  </div>
                </div>

                <button className="btn btn-danger" onClick={() => logout()}>
                  <LogOut size={16} />
                  <span>Logout / Sign Out</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleFirebaseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {errorMsg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-negative-text)', background: 'var(--status-negative-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {isSignUp && (
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Raiyan, Himel, Lazim"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required={isSignUp}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="raiyan@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="dummy123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {isSignUp && (
                  <div className="form-group">
                    <label className="form-label">Link to Housemate Profile</label>
                    <select
                      className="form-select"
                      value={selectedHousemate}
                      onChange={(e) => setSelectedHousemate(e.target.value as UserId)}
                    >
                      {ALL_USERS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Authenticating...' : isSignUp ? 'Create Firebase Account' : 'Sign In with Firebase'}
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
