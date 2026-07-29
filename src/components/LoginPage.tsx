import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ALL_USERS } from '../utils/settlementEngine';
import type { UserId } from '../types';
import { Home, KeyRound, Sparkles, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onSwitchToSignUp: () => void;
}

const DEMO_ACCOUNTS = [
  { id: 'raiyan' as UserId, name: 'Raiyan', email: 'raiyan@gmail.com', password: 'dummy123' },
  { id: 'himel' as UserId, name: 'Himel', email: 'himel@gmail.com', password: 'dummy123' },
  { id: 'lazim' as UserId, name: 'Lazim', email: 'lazim@gmail.com', password: 'dummy123' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignUp }) => {
  const { loginWithEmail, loginOrSignUpDemoAccount } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demo: typeof DEMO_ACCOUNTS[0]) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginOrSignUpDemoAccount(demo.email, demo.password, demo.name, demo.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate demo account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(9, 13, 22, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-card"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            }}
          >
            <Home size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '6px' }}>Home Finance Tracker</h1>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
            Leader-Based Household Settlement & Personal Budget Tracker
          </p>
        </div>

        {/* 1-Click Quick Demo Sign In Cards */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#3b82f6',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <Sparkles size={14} />
            <span>1-Click Demo Accounts (Raiyan, Himel, Lazim)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                onClick={() => handleDemoLogin(demo)}
                disabled={isSubmitting}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserAvatar user={ALL_USERS.find((u) => u.id === demo.id)!} size={26} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{demo.name}</span>
                </div>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  {demo.email} • {demo.password}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Email & Password Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ color: '#cbd5e1' }}>Email Address</label>
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
            <label className="form-label" style={{ color: '#cbd5e1' }}>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="dummy123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '8px' }}
            disabled={isSubmitting}
          >
            <KeyRound size={18} />
            <span>{isSubmitting ? 'Logging In...' : 'Log In to Account'}</span>
          </button>
        </form>

        {/* Link to Standalone Sign Up Page */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Don't have an account yet? </span>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sign Up Here
          </button>
        </div>
      </div>
    </div>
  );
};
