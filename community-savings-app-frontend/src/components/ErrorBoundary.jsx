// ============================================================================
// TITech Community Capital – Error Boundary Component
// File: frontend/src/components/ErrorBoundary.jsx
// ============================================================================

import React from 'react';

// ---------------------------------------------------------------------------
// ErrorBoundary Component
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });

    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
          <p className="mb-4">
            An unexpected error occurred. Please try again or contact support.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px',
                maxWidth: '80%',
                overflowX: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.toString()}
              {'\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------
export default ErrorBoundary;
