import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { Language } from '../utils/i18n';

interface NotFoundPageProps {
  onGoHome: () => void;
  lang?: Language;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: '32px 16px',
      }}
    >
      <div className="glass-card animate-fade-in" style={{ maxWidth: '480px', width: '100%', padding: '40px 28px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            color: 'var(--accent-rose)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            boxShadow: '0 0 25px rgba(244, 63, 94, 0.2)',
          }}
        >
          <AlertCircle size={36} />
        </div>

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
      </div>
    </div>
  );
};
