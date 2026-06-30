// ============================================================================
// TITech Community Capital
// Enterprise Error State Component
// File: frontend/src/components/ErrorState.jsx
// Production Grade
// ============================================================================

import React, { memo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  WifiOff,
  ShieldAlert,
  ServerCrash,
  FileWarning,
} from "lucide-react";

import "./ErrorState.css";

// ============================================================================
// Error Variants
// ============================================================================

export const ERROR_VARIANTS = {
  DEFAULT: "default",
  NETWORK: "network",
  SERVER: "server",
  PERMISSION: "permission",
  NOT_FOUND: "not_found",
};

const ERROR_ICONS = {
  default: AlertTriangle,
  network: WifiOff,
  server: ServerCrash,
  permission: ShieldAlert,
  not_found: FileWarning,
};

const ERROR_TITLES = {
  default: "Something went wrong",
  network: "Network Connection Error",
  server: "Service Temporarily Unavailable",
  permission: "Access Denied",
  not_found: "Resource Not Found",
};

const ERROR_DESCRIPTIONS = {
  default:
    "An unexpected error occurred while processing your request.",
  network:
    "Unable to connect to the server. Please check your internet connection and try again.",
  server:
    "Our services are temporarily unavailable. Please try again in a few moments.",
  permission:
    "You don't have permission to access this resource.",
  not_found:
    "The requested resource could not be found or may have been removed.",
};

// ============================================================================
// Component
// ============================================================================

function ErrorState({
  title,
  description,
  variant = ERROR_VARIANTS.DEFAULT,
  error,
  showRetry = true,
  showHome = false,
  retryLabel = "Try Again",
  homeLabel = "Go Home",
  onRetry,
  onHome,
  className = "",
  compact = false,
  children,
}) {
  const Icon =
    ERROR_ICONS[variant] ||
    AlertTriangle;

  const finalTitle =
    title ||
    ERROR_TITLES[variant] ||
    ERROR_TITLES.default;

  const finalDescription =
    description ||
    ERROR_DESCRIPTIONS[
      variant
    ] ||
    ERROR_DESCRIPTIONS.default;

  const handleRetry =
    useCallback(() => {
      onRetry?.();
    }, [onRetry]);

  const handleHome =
    useCallback(() => {
      onHome?.();
    }, [onHome]);

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={[
        "error-state",
        `error-state-${variant}`,
        compact &&
          "error-state-compact",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ========================================================= */}
      {/* Icon */}
      {/* ========================================================= */}

      <div className="error-state-icon">
        <Icon size={48} />
      </div>

      {/* ========================================================= */}
      {/* Content */}
      {/* ========================================================= */}

      <div className="error-state-content">
        <h2 className="error-state-title">
          {finalTitle}
        </h2>

        <p className="error-state-description">
          {finalDescription}
        </p>

        {error && (
          <div className="error-state-details">
            <code>
              {typeof error ===
              "string"
                ? error
                : error?.message ||
                  "Unknown error"}
            </code>
          </div>
        )}

        {children && (
          <div className="error-state-extra">
            {children}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* Actions */}
      {/* ========================================================= */}

      {(showRetry ||
        showHome) && (
        <div className="error-state-actions">
          {showRetry && (
            <button
              type="button"
              className="error-state-btn primary"
              onClick={
                handleRetry
              }
            >
              <RefreshCw
                size={18}
              />

              {retryLabel}
            </button>
          )}

          {showHome && (
            <button
              type="button"
              className="error-state-btn secondary"
              onClick={
                handleHome
              }
            >
              <Home size={18} />

              {homeLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Presets
// ============================================================================

export const NetworkError =
  (props) => (
    <ErrorState
      variant="network"
      {...props}
    />
  );

export const ServerError =
  (props) => (
    <ErrorState
      variant="server"
      {...props}
    />
  );

export const PermissionError =
  (props) => (
    <ErrorState
      variant="permission"
      showRetry={false}
      {...props}
    />
  );

export const NotFoundError =
  (props) => (
    <ErrorState
      variant="not_found"
      {...props}
    />
  );

// ============================================================================
// Prop Types
// ============================================================================

ErrorState.propTypes = {
  title: PropTypes.string,
  description:
    PropTypes.string,
  variant:
    PropTypes.oneOf(
      Object.values(
        ERROR_VARIANTS
      )
    ),
  error:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]),
  showRetry:
    PropTypes.bool,
  showHome:
    PropTypes.bool,
  retryLabel:
    PropTypes.string,
  homeLabel:
    PropTypes.string,
  onRetry:
    PropTypes.func,
  onHome:
    PropTypes.func,
  className:
    PropTypes.string,
  compact:
    PropTypes.bool,
  children:
    PropTypes.node,
};

ErrorState.defaultProps = {
  variant:
    ERROR_VARIANTS.DEFAULT,
  showRetry: true,
  showHome: false,
  retryLabel: "Try Again",
  homeLabel: "Go Home",
  compact: false,
};

// ============================================================================
// Export
// ============================================================================

export default memo(
  ErrorState
);