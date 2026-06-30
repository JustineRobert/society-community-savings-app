// ============================================================================
// TITech Community Capital
// Enterprise Group Card Component
// File: frontend/src/components/GroupCard.jsx
// Production Grade
// ============================================================================

import React, {
  memo,
  useCallback,
  useMemo,
} from "react";

import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import {
  Calendar,
  ChevronRight,
  Coins,
  MapPin,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

import "./GroupCard.css";

// ============================================================================
// Helpers
// ============================================================================

const currencyFormatter =
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });

function formatCurrency(value) {
  return currencyFormatter.format(
    Number(value || 0)
  );
}

function formatDate(date) {
  if (!date) return "N/A";

  try {
    return new Date(
      date
    ).toLocaleDateString(
      "en-UG",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  } catch {
    return "N/A";
  }
}

// ============================================================================
// Badge Component
// ============================================================================

function Badge({
  label,
  variant = "default",
}) {
  return (
    <span
      className={`group-badge group-badge-${variant}`}
    >
      {label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function GroupCard({
  group,
  showActions = true,
  showMetrics = true,
  compact = false,
  onClick,
  onEdit,
  onDelete,
  className = "",
}) {
  const navigate =
    useNavigate();

  const members =
    useMemo(() => {
      return (
        group?.memberCount ||
        group?.members?.length ||
        0
      );
    }, [group]);

  const contributions =
    useMemo(() => {
      return (
        group?.totalContributions ||
        group?.savings ||
        0
      );
    }, [group]);

  const loans =
    useMemo(() => {
      return (
        group?.totalLoans ||
        group?.loans ||
        0
      );
    }, [group]);

  const handleCardClick =
    useCallback(() => {
      if (onClick) {
        onClick(group);
        return;
      }

      if (group?._id) {
        navigate(
          `/groups/${group._id}`
        );
      }
    }, [
      group,
      navigate,
      onClick,
    ]);

  const handleEdit =
    useCallback(
      (event) => {
        event.stopPropagation();

        onEdit?.(group);
      },
      [group, onEdit]
    );

  const handleDelete =
    useCallback(
      (event) => {
        event.stopPropagation();

        onDelete?.(group);
      },
      [group, onDelete]
    );

  if (!group) return null;

  return (
    <article
      className={`group-card ${compact ? "compact" : ""} ${className}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" ||
          e.key === " "
        ) {
          handleCardClick();
        }
      }}
    >
      {/* =============================================================== */}
      {/* Header */}
      {/* =============================================================== */}

      <div className="group-card-header">
        <div>
          <h3 className="group-card-title">
            {group.name}
          </h3>

          {group.description && (
            <p className="group-card-description">
              {group.description}
            </p>
          )}
        </div>

        <ChevronRight
          size={20}
          className="group-card-arrow"
        />
      </div>

      {/* =============================================================== */}
      {/* Status */}
      {/* =============================================================== */}

      <div className="group-card-badges">
        <Badge
          label={
            group.status ||
            "Active"
          }
          variant={
            (
              group.status ||
              ""
            ).toLowerCase() ===
            "inactive"
              ? "danger"
              : "success"
          }
        />

        {group.isVerified && (
          <Badge
            label="Verified"
            variant="info"
          />
        )}

        {group.isPremium && (
          <Badge
            label="Premium"
            variant="warning"
          />
        )}
      </div>

      {/* =============================================================== */}
      {/* Metrics */}
      {/* =============================================================== */}

      {showMetrics && (
        <div className="group-card-metrics">
          <div className="group-metric">
            <Users size={18} />

            <div>
              <span>
                Members
              </span>
              <strong>
                {members}
              </strong>
            </div>
          </div>

          <div className="group-metric">
            <Wallet size={18} />

            <div>
              <span>
                Savings
              </span>
              <strong>
                {formatCurrency(
                  contributions
                )}
              </strong>
            </div>
          </div>

          <div className="group-metric">
            <Coins size={18} />

            <div>
              <span>
                Loans
              </span>
              <strong>
                {formatCurrency(
                  loans
                )}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Details */}
      {/* =============================================================== */}

      <div className="group-card-details">
        {group.location && (
          <div className="group-detail">
            <MapPin size={16} />
            <span>
              {group.location}
            </span>
          </div>
        )}

        {group.nextContributionDate && (
          <div className="group-detail">
            <Calendar
              size={16}
            />

            <span>
              Next Contribution:
              {" "}
              {formatDate(
                group.nextContributionDate
              )}
            </span>
          </div>
        )}

        {group.riskLevel && (
          <div className="group-detail">
            <Shield size={16} />

            <span>
              Risk:
              {" "}
              {group.riskLevel}
            </span>
          </div>
        )}
      </div>

      {/* =============================================================== */}
      {/* Footer */}
      {/* =============================================================== */}

      <footer className="group-card-footer">
        <div className="group-created">
          Created:
          {" "}
          {formatDate(
            group.createdAt
          )}
        </div>

        {showActions && (
          <div className="group-actions">
            {onEdit && (
              <button
                className="group-btn secondary"
                onClick={
                  handleEdit
                }
              >
                Edit
              </button>
            )}

            {onDelete && (
              <button
                className="group-btn danger"
                onClick={
                  handleDelete
                }
              >
                Delete
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}

// ============================================================================
// PropTypes
// ============================================================================

GroupCard.propTypes = {
  group: PropTypes.object
    .isRequired,
  compact:
    PropTypes.bool,
  showActions:
    PropTypes.bool,
  showMetrics:
    PropTypes.bool,
  className:
    PropTypes.string,
  onClick:
    PropTypes.func,
  onEdit:
    PropTypes.func,
  onDelete:
    PropTypes.func,
};

GroupCard.defaultProps = {
  compact: false,
  showActions: true,
  showMetrics: true,
  className: "",
};

// ============================================================================
// Export
// ============================================================================

export default memo(
  GroupCard
);