import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Home,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';

interface SignUpPageProps {
  onSwitchToLogin: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToLogin }) => {
  const { signUpWithEmail } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!displayName.trim()) return setErrorMsg('Please enter your display name.');
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match. Please verify and try again.');
    if (password.length < 6) return setErrorMsg('Password should be at least 6 characters long.');
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim());
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Sign up failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-ambient auth-ambient-signup" aria-hidden="true"><span /><span /><span /></div>
      <section className="auth-showcase">
        <div className="auth-brand"><span><Home size={22} /></span> Home Finance</div>
        <div className="auth-showcase-copy">
          <div className="auth-eyebrow"><Sparkles size={14} /> One home. One shared view.</div>
          <h1>Make money feel<br /><em>effortless together.</em></h1>
          <p>Create a private financial space for your household, with transparent splits and personal spending that stays personal.</p>
          <div className="auth-feature-row">
            <span><Users size={17} /> Invite your household</span>
            <span><WalletCards size={17} /> Track every channel</span>
            <span><ShieldCheck size={17} /> Your data, protected</span>
          </div>
        </div>
        <p className="auth-footnote">Set up in a minute. Stay organized every day.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel auth-panel-signup">
          <div className="auth-panel-header">
            <div className="auth-mobile-brand"><UserPlus size={20} /></div>
            <span className="auth-kicker">Get started</span>
            <h2>Create your account</h2>
            <p>Your household space comes next.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {errorMsg && <div className="auth-error" role="alert"><AlertCircle size={18} /><span>{errorMsg}</span></div>}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Display name</label>
              <input id="signup-name" type="text" className="form-input" placeholder="How others will see you" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email address</label>
              <input id="signup-email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </div>
            <div className="auth-form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Password</label>
                <div className="password-field">
                  <input id="signup-password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="6+ characters" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-confirm">Confirm</label>
                <div className="password-field">
                  <input id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'} className="form-input" placeholder="Repeat password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
              <ShieldCheck size={18} /><span>{isSubmitting ? 'Creating your space…' : 'Create account'}</span>
            </button>
          </form>

          <div className="auth-switch">Already have an account? <button type="button" onClick={onSwitchToLogin}>Sign in</button></div>
        </div>
      </section>
    </main>
  );
};
