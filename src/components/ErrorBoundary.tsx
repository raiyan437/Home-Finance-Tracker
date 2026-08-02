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
        <main className="system-state-shell">
          <section className="system-state-card" role="alert">
            <span className="system-state-icon system-state-icon-error"><AlertCircle size={32} /></span>
            <h2>Something went wrong</h2>
            <p>
              The application encountered a temporary error: <br />
              <code className="system-state-code">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </p>
            <button className="btn btn-primary" onClick={this.handleReload}>
              <RefreshCw size={16} />
              <span>Reload Application</span>
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
