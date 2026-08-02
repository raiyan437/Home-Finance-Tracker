import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';

interface LoginPageProps {
  onSwitchToSignUp: () => void;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignUp, onLoginSuccess }) => {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
      onLoginSuccess();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-ambient" aria-hidden="true"><span /><span /><span /></div>
      <section className="auth-showcase">
        <div className="auth-brand"><span><Home size={22} /></span> Home Finance</div>
        <div className="auth-showcase-copy">
          <div className="auth-eyebrow"><Sparkles size={14} /> A calmer way to manage money</div>
          <h1>Shared finances,<br /><em>beautifully clear.</em></h1>
          <p>Track household spending, settle balances, and keep your personal wallet private—all in one focused space.</p>
          <div className="auth-feature-row">
            <span><Users size={17} /> Fair household splits</span>
            <span><WalletCards size={17} /> Personal insights</span>
            <span><ShieldCheck size={17} /> Secure by design</span>
          </div>
        </div>
        <p className="auth-footnote">Simple decisions. Fewer money conversations.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-panel-header">
            <div className="auth-mobile-brand"><Home size={20} /></div>
            <span className="auth-kicker">Welcome back</span>
            <h2>Sign in to your space</h2>
            <p>Continue where your household left off.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {errorMsg && <div className="auth-error" role="alert"><AlertCircle size={18} /><span>{errorMsg}</span></div>}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address</label>
              <input id="login-email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="password-field">
                <input id="login-password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
              <KeyRound size={18} /><span>{isSubmitting ? 'Signing in…' : 'Continue'}</span>
            </button>
          </form>

          <div className="auth-switch">New to Home Finance? <button type="button" onClick={onSwitchToSignUp}>Create an account</button></div>
        </div>
      </section>
    </main>
  );
};
