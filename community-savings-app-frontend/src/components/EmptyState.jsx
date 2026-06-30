// ============================================================================
// TITech Community Capital
// Enterprise Empty State Component
// File: frontend/src/components/EmptyState.jsx
// Production Grade
// ============================================================================

import React, { memo } from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  Database,
  FileSearch,
  Inbox,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import "./EmptyState.css";

// ============================================================================
// Icon Registry
// ============================================================================

const ICONS = {
  inbox: Inbox,
  search: Search,
  database: Database,
  files: FileSearch,
  error: AlertCircle,
  add: PlusCircle,
};

// ============================================================================
// Component
// ============================================================================

function EmptyState({
  title = "No Data Available",
  description = "There is nothing to display at the moment.",
  icon = "inbox",
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  loading = false,
  compact = false,
  className = "",
  children,
}) {
  const Icon =
    ICONS[icon] || Inbox;

  return (
    <div
      className={`empty-state ${
        compact
          ? "empty-state-compact"
          : ""
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* ========================================================= */}
      {/* Icon */}
      {/* ========================================================= */}

      <div className="empty-state-icon">
        {loading ? (
          <RefreshCw
            className="empty-state-spinner"
            size={52}
          />
        ) : (
          <Icon size={52} />
        )}
      </div>

      {/* ========================================================= */}
      {/* Content */}
      {/* ========================================================= */}

      <div className="empty-state-content">
        <h2 className="empty-state-title">
          {title}
        </h2>

        {description && (
          <p className="empty-state-description">
            {description}
          </p>
        )}

        {children}
      </div>

      {/* ========================================================= */}
      {/* Actions */}
      {/* ========================================================= */}

      {(actionLabel ||
        secondaryActionLabel) && (
        <div className="empty-state-actions">
          {actionLabel && (
            <button
              className="empty-state-btn primary"
              onClick={
                onAction
              }
              disabled={loading}
            >
              {actionLabel}
            </button>
          )}

          {secondaryActionLabel && (
            <button
              className="empty-state-btn secondary"
              onClick={
                onSecondaryAction
              }
              disabled={loading}
            >
              {
                secondaryActionLabel
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Prop Types
// ============================================================================

EmptyState.propTypes = {
  title:
    PropTypes.string,

  description:
    PropTypes.string,

  icon:
    PropTypes.oneOf([
      "inbox",
      "search",
      "database",
      "files",
      "error",
      "add",
    ]),

  actionLabel:
    PropTypes.string,

  onAction:
    PropTypes.func,

  secondaryActionLabel:
    PropTypes.string,

  onSecondaryAction:
    PropTypes.func,

  loading:
    PropTypes.bool,

  compact:
    PropTypes.bool,

  className:
    PropTypes.string,

  children:
    PropTypes.node,
};

EmptyState.defaultProps = {
  title: "No Data Available",
  description:
    "There is nothing to display at the moment.",
  icon: "inbox",
  loading: false,
  compact: false,
  className: "",
};

// ============================================================================
// Enterprise Presets
// ============================================================================

export const EmptyGroups = (
  props
) => (
  <EmptyState
    icon="database"
    title="No Community Groups"
    description="Create your first savings group to start managing contributions and loans."
    actionLabel="Create Group"
    {...props}
  />
);

export const EmptySearch = (
  props
) => (
  <EmptyState
    icon="search"
    title="No Results Found"
    description="Try adjusting your filters or search terms."
    {...props}
  />
);

export const EmptyTransactions =
  (props) => (
    <EmptyState
      icon="files"
      title="No Transactions"
      description="No transactions have been recorded yet."
      {...props}
    />
  );

export const EmptyError = (
  props
) => (
  <EmptyState
    icon="error"
    title="Something Went Wrong"
    description="An unexpected error occurred while loading this data."
    actionLabel="Retry"
    {...props}
  />
);

// ============================================================================
// Export
// ============================================================================

export default memo(
  EmptyState
);