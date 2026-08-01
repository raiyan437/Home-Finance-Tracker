import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { shareHouseCode } from '../utils/share';
import {
  Home,
  UserX,
  Copy,
  Check,
  Plus,
  LogIn,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Users,
  Edit3,
  Share2,
} from 'lucide-react';
import type { Language } from '../utils/i18n';

interface HouseViewProps {
  lang?: Language;
}

export const HousePage: React.FC<HouseViewProps> = () => {
  const {
    firebaseUser,
    dbUserProfile,
    currentHouse,
    createHouse,
    joinHouse,
    updateHouseName,
    kickMember,
    leaveHouse,
  } = useAuth();

  const [createHouseName, setCreateHouseName] = useState('');
  const [createHouseCode, setCreateHouseCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kickingUid, setKickingUid] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // House Name Edit States
  const [isEditingHouseName, setIsEditingHouseName] = useState(false);
  const [newHouseNameInput, setNewHouseNameInput] = useState('');

  const isLeader =
    Boolean(firebaseUser && currentHouse && currentHouse.leaderUid === firebaseUser.uid) ||
    dbUserProfile?.role === 'leader';

  const handleCopyCode = () => {
    if (!currentHouse) return;
    navigator.clipboard.writeText(currentHouse.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareHouseCode = async () => {
    if (!currentHouse) return;
    const res = await shareHouseCode(currentHouse.code, currentHouse.name);
    if (res.success) {
      setShareFeedback(res.method === 'share' ? 'Shared successfully!' : 'Code copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 2500);
    }
  };

  const handleCreateHouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      await createHouse(createHouseName, createHouseCode);
      setCreateHouseName('');
      setCreateHouseCode('');
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

  const handleSaveHouseName = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!newHouseNameInput.trim()) return;

    try {
      await updateHouseName(newHouseNameInput.trim());
      setSuccessMsg('House name updated successfully!');
      setIsEditingHouseName(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update house name.');
    }
  };

  const handleKickConfirm = async (targetUid: string) => {
    if (!window.confirm('Are you sure you want to kick this member from the house?')) return;
    setKickingUid(targetUid);
    setErrorMsg(null);

    try {
      await kickMember(targetUid);
      setSuccessMsg('Member removed from house.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member.');
    } finally {
      setKickingUid(null);
    }
  };

  const handleLeaveHouseConfirm = async () => {
    if (!window.confirm('Are you sure you want to leave this house?')) return;
    setErrorMsg(null);

    try {
      await leaveHouse();
      setSuccessMsg('You have left the house.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to leave house.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Household Space & Members</h1>
          <p className="page-description">
            Manage your shared household, invite housemates, and track roster membership
          </p>
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

      {/* SECTION 1: HOUSE CREATION / JOIN / MANAGEMENT */}
      {!currentHouse ? (
        <div className="grid-2">
          {/* Create House Form */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Plus size={22} style={{ color: 'var(--accent-emerald)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create a New House</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Set up a shared household space and invite housemates</p>
              </div>
            </div>

            <form onSubmit={handleCreateHouseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Household Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bachelor Villa 4B"
                    value={createHouseName}
                    onChange={(e) => setCreateHouseName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Custom House Code (6 Characters)</label>
                  <input
                    type="text"
                    className="form-input tabular-nums"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={createHouseCode}
                    onChange={(e) => setCreateHouseCode(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }} disabled={isSubmitting || !createHouseName.trim() || !createHouseCode.trim()}>
                <Plus size={16} />
                <span>{isSubmitting ? 'Creating House...' : 'Create Household'}</span>
              </button>
            </form>
          </div>

          {/* Join House Form */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <LogIn size={22} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Join an Existing House</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Enter 6-character code provided by your House Leader</p>
              </div>
            </div>

            <form onSubmit={handleJoinHouseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">House Join Code</label>
                  <input
                    type="text"
                    className="form-input tabular-nums"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-secondary" style={{ marginTop: '12px' }} disabled={isSubmitting || !joinCodeInput.trim()}>
                <LogIn size={16} />
                <span>{isSubmitting ? 'Joining House...' : 'Join Household'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Active House Management Card */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ borderTop: '4px solid var(--accent-emerald)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Home size={26} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {!isEditingHouseName ? (
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        {currentHouse.name}
                      </h2>
                    ) : (
                      <form onSubmit={handleSaveHouseName} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 12px', fontSize: '1rem' }}
                          value={newHouseNameInput}
                          onChange={(e) => setNewHouseNameInput(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingHouseName(false)}>Cancel</button>
                      </form>
                    )}

                    {isLeader && !isEditingHouseName && (
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setNewHouseNameInput(currentHouse.name);
                          setIsEditingHouseName(true);
                        }}
                        title="Edit House Name"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Created on {new Date(currentHouse.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* House Join Code Box & Native Share */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 800 }}>
                    House Join Code
                  </span>
                  <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                    {currentHouse.code}
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleCopyCode} title="Copy Code">
                  {copiedCode ? <Check size={16} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={16} />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>

                <button className="btn btn-primary btn-sm" onClick={handleShareHouseCode} title="Share House Code via App">
                  <Share2 size={15} />
                  <span>Share App</span>
                </button>

                {shareFeedback && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                    {shareFeedback}
                  </span>
                )}
              </div>
            </div>

            {/* House Member Roster */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <UserAvatar
                          user={{
                            id: member.uid,
                            name: member.displayName,
                            avatar: member.avatar || (dbUserProfile?.uid === member.uid ? dbUserProfile?.avatar : undefined),
                            color: '#3b82f6',
                          }}
                          size={40}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>{member.displayName}</span>
                            {memberIsLeader && (
                              <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', fontSize: '0.7rem', padding: '2px 8px' }}>
                                Leader
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.email}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {canKick && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleKickConfirm(member.uid)}
                            disabled={kickingUid === member.uid}
                          >
                            <UserX size={14} />
                            <span>{kickingUid === member.uid ? 'Kicking...' : 'Kick Member'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
