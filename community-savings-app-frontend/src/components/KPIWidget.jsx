// ============================================================================
// TITech Community Capital
// Enterprise KPI Widget
// File: frontend/src/components/KPIWidget.jsx
// Production Grade
// ============================================================================

import React, {
  memo,
  useMemo,
} from "react";

import PropTypes from "prop-types";

import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingUp,
} from "lucide-react";

import "./KPIWidget.css";

// ============================================================================
// Helpers
// ============================================================================

const formatValue = (
  value,
  {
    type = "number",
    currency = "UGX",
    decimals = 0,
    locale = "en-UG",
  } = {}
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "--";
  }

  switch (type) {
    case "currency":
      return new Intl.NumberFormat(
        locale,
        {
          style:
            "currency",
          currency,
          maximumFractionDigits:
            decimals,
        }
      ).format(
        Number(value)
      );

    case "percentage":
      return `${Number(
        value
      ).toFixed(
        decimals
      )}%`;

    case "decimal":
      return Number(
        value
      ).toFixed(decimals);

    default:
      return new Intl.NumberFormat(
        locale
      ).format(
        Number(value)
      );
  }
};

// ============================================================================
// Trend Badge
// ============================================================================

function TrendBadge({
  change,
}) {
  const direction =
    change > 0
      ? "up"
      : change < 0
      ? "down"
      : "flat";

  const Icon =
    direction === "up"
      ? ArrowUp
      : direction === "down"
      ? ArrowDown
      : Minus;

  return (
    <div
      className={`kpi-trend ${direction}`}
    >
      <Icon size={14} />

      <span>
        {Math.abs(
          Number(change || 0)
        ).toFixed(1)}
        %
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function KPIWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  type = "number",
  currency = "UGX",
  decimals = 0,
  loading = false,
  color = "primary",
  onClick,
  footer,
  locale = "en-UG",
  className = "",
  trendLabel = "vs last period",
}) {
  const formattedValue =
    useMemo(() => {
      return formatValue(
        value,
        {
          type,
          currency,
          decimals,
          locale,
        }
      );
    }, [
      value,
      type,
      currency,
      decimals,
      locale,
    ]);

  return (
    <div
      className={`kpi-widget ${color} ${className} ${
        onClick
          ? "clickable"
          : ""
      }`}
      onClick={onClick}
      role={
        onClick
          ? "button"
          : undefined
      }
      tabIndex={
        onClick ? 0 : -1
      }
    >
      {/* Header */}
      <div className="kpi-header">
        <div>
          <h4 className="kpi-title">
            {title}
          </h4>

          {subtitle && (
            <p className="kpi-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div className="kpi-icon">
            <Icon size={26} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="kpi-body">
        {loading ? (
          <div className="kpi-skeleton">
            <div className="kpi-line" />
          </div>
        ) : (
          <h2 className="kpi-value">
            {formattedValue}
          </h2>
        )}
      </div>

      {/* Footer */}
      <div className="kpi-footer">
        {change !==
          undefined &&
          change !==
            null && (
            <>
              <TrendBadge
                change={change}
              />

              <span className="kpi-trend-label">
                {trendLabel}
              </span>
            </>
          )}

        {!change &&
          footer && (
            <div className="kpi-custom-footer">
              {footer}
            </div>
          )}
      </div>
    </div>
  );
}

// ============================================================================
// Prop Types
// ============================================================================

KPIWidget.propTypes = {
  title:
    PropTypes.string
      .isRequired,

  value:
    PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),

  subtitle:
    PropTypes.string,

  icon:
    PropTypes.elementType,

  change:
    PropTypes.number,

  type:
    PropTypes.oneOf([
      "number",
      "currency",
      "percentage",
      "decimal",
    ]),

  currency:
    PropTypes.string,

  decimals:
    PropTypes.number,

  loading:
    PropTypes.bool,

  color:
    PropTypes.oneOf([
      "primary",
      "success",
      "warning",
      "danger",
      "info",
      "purple",
    ]),

  locale:
    PropTypes.string,

  footer:
    PropTypes.node,

  className:
    PropTypes.string,

  onClick:
    PropTypes.func,

  trendLabel:
    PropTypes.string,
};

KPIWidget.defaultProps = {
  value: 0,
  subtitle: "",
  loading: false,
  color: "primary",
  type: "number",
  currency: "UGX",
  decimals: 0,
  locale: "en-UG",
  trendLabel:
    "vs last period",
};

// ============================================================================
// Export
// ============================================================================

export default memo(
  KPIWidget
);