// ============================================================================
// TITech Community Capital
// Enterprise Route Error Boundary
// File: src/routes/RouteErrorBoundary.jsx
// Production Grade
// ============================================================================

import React from "react";
import {
  AlertTriangle,
  RefreshCw,
  Home,
} from "lucide-react";

// ============================================================================
// Utilities
// ============================================================================

function generateCorrelationId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}

function isChunkLoadError(error) {
  const message =
    error?.message?.toLowerCase() ||
    "";

  return (
    message.includes(
      "loading chunk"
    ) ||
    message.includes(
      "chunkloaderror"
    ) ||
    message.includes(
      "failed to fetch dynamically imported module"
    )
  );
}

// ============================================================================
// Default Fallback
// ============================================================================

function DefaultFallback({
  error,
  correlationId,
  onRetry,
  onHome,
}) {
  return (
    <div className="route-error-page">
      <div className="route-error-card">
        <AlertTriangle
          size={56}
        />

        <h1>
          Something went wrong
        </h1>

        <p>
          An unexpected error
          occurred while loading
          this page.
        </p>

        {import.meta.env.DEV &&
          error && (
            <pre className="route-error-details">
              {error.stack ||
                error.message}
            </pre>
          )}

        <div className="route-error-meta">
          <strong>
            Error ID:
          </strong>{" "}
          {correlationId}
        </div>

        <div className="route-error-actions">
          <button
            onClick={
              onRetry
            }
            className="btn-primary"
          >
            <RefreshCw
              size={18}
            />
            Retry
          </button>

          <button
            onClick={
              onHome
            }
            className="btn-secondary"
          >
            <Home
              size={18}
            />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Boundary
// ============================================================================

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId:
        generateCorrelationId(),
    };
  }

  // ===========================================================================
  // Capture Error
  // ===========================================================================

  static getDerivedStateFromError(
    error
  ) {
    return {
      hasError: true,
      error,
    };
  }

  // ===========================================================================
  // Error Logging
  // ===========================================================================

  componentDidCatch(
    error,
    errorInfo
  ) {
    this.setState({
      errorInfo,
    });

    const payload = {
      correlationId:
        this.state
          .correlationId,
      message:
        error?.message,
      stack:
        error?.stack,
      componentStack:
        errorInfo?.componentStack,
      timestamp:
        new Date().toISOString(),
      pathname:
        window.location
          .pathname,
      userAgent:
        navigator.userAgent,
    };

    console.error(
      "[ROUTE ERROR]",
      payload
    );

    if (
      typeof this.props
        .onError ===
      "function"
    ) {
      try {
        this.props.onError(
          payload
        );
      } catch {
        // ignore logging failures
      }
    }

    // Chunk loading errors
    if (
      isChunkLoadError(
        error
      )
    ) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  // ===========================================================================
  // Retry
  // ===========================================================================

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId:
        generateCorrelationId(),
    });
  };

  // ===========================================================================
  // Home
  // ===========================================================================

  handleHome = () => {
    window.location.href =
      "/dashboard";
  };

  // ===========================================================================
  // Route Change Reset
  // ===========================================================================

  componentDidUpdate(
    prevProps
  ) {
    const previousPath =
      prevProps.pathname;

    const currentPath =
      this.props.pathname;

    if (
      previousPath !==
        currentPath &&
      this.state.hasError
    ) {
      this.handleRetry();
    }
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  render() {
    if (
      this.state.hasError
    ) {
      const Fallback =
        this.props.fallback ||
        DefaultFallback;

      return (
        <Fallback
          error={
            this.state.error
          }
          errorInfo={
            this.state
              .errorInfo
          }
          correlationId={
            this.state
              .correlationId
          }
          onRetry={
            this.handleRetry
          }
          onHome={
            this.handleHome
          }
        />
      );
    }

    return this.props
      .children;
  }
}

// ============================================================================
// Route Wrapper
// ============================================================================

export function withRouteErrorBoundary(
  Component,
  options = {}
) {
  function Wrapped(
    props
  ) {
    return (
      <RouteErrorBoundary
        {...options}
      >
        <Component
          {...props}
        />
      </RouteErrorBoundary>
    );
  }

  Wrapped.displayName =
    `withRouteErrorBoundary(${
      Component.displayName ||
      Component.name ||
      "Component"
    })`;

  return Wrapped;
}

// ============================================================================
// Export
// ============================================================================

export default RouteErrorBoundary;