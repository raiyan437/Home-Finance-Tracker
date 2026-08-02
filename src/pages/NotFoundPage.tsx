import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { Language } from '../utils/i18n';

interface NotFoundPageProps {
  onGoHome: () => void;
  lang?: Language;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  return (
    <main className="system-state-shell system-state-inline">
      <section className="system-state-card animate-fade-in">
        <span className="system-state-icon system-state-icon-error">
          <AlertCircle size={36} />
        </span>

        <div className="font-display" style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
          404
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '12px 0 8px 0' }}>
          Page Not Found
        </h2>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.5 }}>
          The page or route you are looking for does not exist or may have been moved.
        </p>

        <button className="btn btn-primary" onClick={onGoHome} style={{ width: '100%', justifyContent: 'center' }}>
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>
      </section>
    </main>
  );
};
