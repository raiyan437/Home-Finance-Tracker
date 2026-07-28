import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#f8fafc', padding: '24px' }}>
          <div style={{ backgroundColor: '#131b2e', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
            <AlertCircle size={56} style={{ color: '#f43f5e', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Oops! Something went wrong</h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
              The application encountered a temporary error: <br />
              <code style={{ fontSize: '0.78rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '8px' }}>
                {this.state.error?.message || 'Unknown error'}
              </code>
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={16} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
