
// src/components/ErrorBoundary.jsx
import React from 'react';

/**
 * ErrorFallback:
 * - Lightweight, user-friendly fallback UI.
 * - Receives the error, a reset handler, and optional context.
 */
export function ErrorFallback({ error, resetErrorBoundary, context }) {
  // Avoid leaking potentially sensitive info in production; show minimal details.
  const isDev = process.env.NODE_ENV !== 'production';
  return (
    <div
      role="alert"
      style={{
        padding: '2rem',
        margin: '2rem',
        borderRadius: 8,
        border: '1px solid #f5c2c7',
        background: '#f8d7da',
        color: '#58151c',
      }}
    >
      <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
      <p>We couldn’t load this page. Please try again.</p>

      {isDev && error && (
        <pre
          style={{
            background: '#fff',
            color: '#222',
            padding: '1rem',
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 240,
            border: '1px solid #eee',
          }}
        >
          {String(error?.stack || error)}
        </pre>
      )}

      {context && (
        <p style={{ fontSize: 12, opacity: 0.8 }}>Context: {context}</p>
      )}

      <button
        type="button"
        onClick={resetErrorBoundary}
        style={{
          marginTop: '1rem',
          background: '#0d6efd',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '0.5rem 1rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * ErrorBoundary:
 * - Catches render/runtime errors in child tree.
 * - Supports reset via `resetKeys` changes (e.g., on route change).
 * - Optionally calls `onError` and `onReset` handlers.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { onError } = this.props;
    // Report error to your logging/observability tool (Sentry/Datadog/etc.)
    if (typeof onError === 'function') {
      onError(error, errorInfo);
    } else {
      // Default console.warn to avoid noisy logs in production
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('ErrorBoundary caught an error:', error, errorInfo);
      }
    }
  }

  componentDidUpdate(prevProps) {
    const { resetKeys = [] } = this.props;
    // If any reset key changed, clear the error state
    const hasReset = Array.isArray(resetKeys) && resetKeys.length > 0
      && resetKeys.some((key, i) => !Object.is(key, prevProps.resetKeys?.[i]));
    if (hasReset && this.state.hasError) {
      this.reset();
    }
  }

  reset = () => {
    const { onReset } = this.props;
    if (typeof onReset === 'function') {
      onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { FallbackComponent = ErrorFallback, fallbackProps, children } = this.props;

    if (hasError) {
      return (
        <FallbackComponent
          error={error}
          resetErrorBoundary={this.reset}
          {...(fallbackProps || {})}
        />
      );
    }
    return children;
  }
}  
