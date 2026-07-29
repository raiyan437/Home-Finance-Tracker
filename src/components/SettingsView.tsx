import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import {
  Settings,
  Home,
  Crown,
  UserCheck,
  UserX,
  Copy,
  Check,
  Plus,
  LogIn,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Users,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    firebaseUser,
    dbUserProfile,
    currentHouse,
    createHouse,
    joinHouse,
    kickMember,
    leaveHouse,
    logout,
  } = useAuth();

  const [createHouseName, setCreateHouseName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kickingUid, setKickingUid] = useState<string | null>(null);

  const isLeader =
    Boolean(firebaseUser && currentHouse && currentHouse.leaderUid === firebaseUser.uid) ||
    dbUserProfile?.role === 'leader';

  const handleCopyCode = () => {
    if (!currentHouse) return;
    navigator.clipboard.writeText(currentHouse.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateHouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      await createHouse(createHouseName);
      setCreateHouseName('');
      setSuccessMsg('House created successfully! You are now the House Leader.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create house. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinHouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      await joinHouse(joinCodeInput);
      setJoinCodeInput('');
      setSuccessMsg('Successfully joined house!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join house.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKickConfirm = async (targetUid: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setKickingUid(targetUid);

    try {
      await kickMember(targetUid);
      setSuccessMsg('Member kicked successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to kick member.');
    } finally {
      setKickingUid(null);
    }
  };

  const handleLeaveHouseConfirm = async () => {
    if (!window.confirm('Are you sure you want to leave this house?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await leaveHouse();
      setSuccessMsg('You have left the house.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to leave house.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Settings size={28} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h1 className="page-title">House & Settings</h1>
              <p className="page-description">
                Leader-based household management, House Code sharing, member rosters, and access controls
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            color: 'var(--accent-rose)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            fontSize: '0.98rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--accent-emerald)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.98rem',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CASE A: USER HAS NO HOUSE ASSIGNED */}
      {!currentHouse ? (
        <div className="grid-summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Create House Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.18)',
                  color: 'var(--accent-primary)',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Plus size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create a New House</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Start a new household, become the 👑 Leader, and get a unique House Code.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateHouseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Household Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Raiyan & Friends Villa, Flat 4B"
                  value={createHouseName}
                  onChange={(e) => setCreateHouseName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Crown size={16} />
                <span>{isSubmitting ? 'Creating...' : 'Create House & Become Leader'}</span>
              </button>
            </form>
          </div>

          {/* Join Existing House Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.18)',
                  color: 'var(--accent-emerald)',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <LogIn size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Join an Existing House</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Ask your House Leader for the 6-character House Code (e.g., HM-8823).
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinHouseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">6-Character House Code</label>
                <input
                  type="text"
                  className="form-input tabular-nums"
                  placeholder="HM-8823"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                <LogIn size={16} />
                <span>{isSubmitting ? 'Joining...' : 'Join House'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* CASE B: ACTIVE HOUSE MEMBER / LEADER VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Permanent House Code Banner */}
          <div
            className="glass-card"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(139, 92, 246, 0.18))',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
              padding: '24px 28px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Home size={24} style={{ color: 'var(--accent-primary)' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{currentHouse.name}</h2>
                {isLeader ? (
                  <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', fontSize: '0.78rem' }}>
                    <Crown size={12} /> House Leader
                  </span>
                ) : (
                  <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', fontSize: '0.78rem' }}>
                    <UserCheck size={12} /> Member
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Share this unique 6-character code with your housemates so they can join your finance group.
              </p>
            </div>

            {/* Code Box & Copy Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '2px dashed var(--accent-primary)',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  color: 'var(--accent-primary)',
                }}
              >
                {currentHouse.code}
              </div>

              <button
                className={`btn ${copiedCode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: '48px', padding: '0 18px' }}
                onClick={handleCopyCode}
              >
                {copiedCode ? <Check size={18} /> : <Copy size={18} />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Member Roster Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={22} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>House Member Roster ({currentHouse.members?.length || 0})</h3>
              </div>

              {!isLeader && (
                <button className="btn btn-danger btn-sm" onClick={handleLeaveHouseConfirm}>
                  <LogOut size={14} />
                  <span>Leave House</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentHouse.members?.map((member) => {
                const memberIsLeader = member.role === 'leader' || member.uid === currentHouse.leaderUid;
                const canKick = isLeader && !memberIsLeader;

                return (
                  <div
                    key={member.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <UserAvatar
                        user={{
                          id: member.uid,
                          name: member.displayName,
                          avatar: member.avatar || member.displayName?.charAt(0) || 'U',
                          color: memberIsLeader ? '#f59e0b' : '#3b82f6',
                        }}
                        size={40}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>{member.displayName}</span>
                          {memberIsLeader ? (
                            <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', fontSize: '0.72rem' }}>
                              <Crown size={12} /> Leader
                            </span>
                          ) : (
                            <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', fontSize: '0.72rem' }}>
                              <UserCheck size={12} /> Member
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.email}</div>
                      </div>
                    </div>

                    {/* Kick Button for Leader */}
                    {canKick && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={kickingUid === member.uid}
                        onClick={() => handleKickConfirm(member.uid)}
                      >
                        <UserX size={14} />
                        <span>{kickingUid === member.uid ? 'Kicking...' : 'Kick Member'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Account Info & Logout Card */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <UserAvatar
            user={{
              id: dbUserProfile?.uid || 'user',
              name: dbUserProfile?.displayName || 'User',
              avatar: dbUserProfile?.avatar || 'U',
              color: '#3b82f6',
            }}
            size={42}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {dbUserProfile?.displayName || firebaseUser?.displayName || 'Active Account'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {firebaseUser?.email || 'Logged in locally'}
            </div>
          </div>
        </div>

        {firebaseUser && (
          <button className="btn btn-danger" onClick={() => logout()}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        )}
      </div>
    </div>
  );
};
