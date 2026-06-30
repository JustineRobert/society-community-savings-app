// ============================================================================
// TITech Community Capital
// Enterprise Dashboard Skeleton
// File: frontend/src/components/DashboardSkeleton.jsx
// Production Grade
// ============================================================================

import React, { memo } from "react";
import PropTypes from "prop-types";

import "./DashboardSkeleton.css";

// ============================================================================
// Skeleton Block
// ============================================================================

function Skeleton({
  width,
  height,
  className = "",
}) {
  return (
    <div
      className={`dashboard-skeleton-block ${className}`}
      style={{
        width,
        height,
      }}
    />
  );
}

// ============================================================================
// Stat Card Skeleton
// ============================================================================

function StatCardSkeleton() {
  return (
    <div className="dashboard-stat-skeleton">
      <Skeleton
        width={48}
        height={48}
        className="dashboard-skeleton-circle"
      />

      <div className="dashboard-stat-content">
        <Skeleton
          width="60%"
          height={14}
        />

        <Skeleton
          width="80%"
          height={32}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Chart Skeleton
// ============================================================================

function ChartSkeleton() {
  return (
    <div className="dashboard-chart-skeleton">
      <Skeleton
        width="45%"
        height={18}
      />

      <div className="dashboard-chart-area">
        {Array.from({
          length: 7,
        }).map((_, index) => (
          <div
            key={index}
            className="dashboard-chart-bar"
            style={{
              height: `${
                35 +
                Math.random() *
                  60
              }%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Group Card Skeleton
// ============================================================================

function GroupCardSkeleton() {
  return (
    <div className="dashboard-group-skeleton">
      <Skeleton
        width="70%"
        height={22}
      />

      <Skeleton
        width="100%"
        height={14}
      />

      <Skeleton
        width="85%"
        height={14}
      />

      <div className="dashboard-group-footer">
        <Skeleton
          width="35%"
          height={14}
        />

        <Skeleton
          width="30%"
          height={14}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard Skeleton
// ============================================================================

function DashboardSkeleton({
  stats = 4,
  charts = 2,
  groups = 6,
  showHeader = true,
  showSidebar = false,
}) {
  return (
    <div className="dashboard-skeleton-container">
      {/* ============================================================= */}
      {/* Sidebar */}
      {/* ============================================================= */}

      {showSidebar && (
        <aside className="dashboard-sidebar-skeleton">
          <Skeleton
            width="70%"
            height={32}
          />

          {Array.from({
            length: 8,
          }).map(
            (_, index) => (
              <Skeleton
                key={index}
                width="100%"
                height={16}
              />
            )
          )}
        </aside>
      )}

      <div className="dashboard-skeleton-main">
        {/* =========================================================== */}
        {/* Header */}
        {/* =========================================================== */}

        {showHeader && (
          <div className="dashboard-header-skeleton">
            <div>
              <Skeleton
                width={260}
                height={32}
              />

              <Skeleton
                width={180}
                height={16}
              />
            </div>

            <div className="dashboard-header-actions">
              <Skeleton
                width={42}
                height={42}
                className="dashboard-skeleton-circle"
              />

              <Skeleton
                width={42}
                height={42}
                className="dashboard-skeleton-circle"
              />

              <Skeleton
                width={120}
                height={42}
              />
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* Stats */}
        {/* =========================================================== */}

        <section className="dashboard-stats-grid">
          {Array.from({
            length: stats,
          }).map(
            (_, index) => (
              <StatCardSkeleton
                key={index}
              />
            )
          )}
        </section>

        {/* =========================================================== */}
        {/* Charts */}
        {/* =========================================================== */}

        <section className="dashboard-charts-grid">
          {Array.from({
            length: charts,
          }).map(
            (_, index) => (
              <ChartSkeleton
                key={index}
              />
            )
          )}
        </section>

        {/* =========================================================== */}
        {/* Groups */}
        {/* =========================================================== */}

        <section className="dashboard-groups-grid">
          {Array.from({
            length: groups,
          }).map(
            (_, index) => (
              <GroupCardSkeleton
                key={index}
              />
            )
          )}
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Prop Types
// ============================================================================

DashboardSkeleton.propTypes =
  {
    stats:
      PropTypes.number,
    charts:
      PropTypes.number,
    groups:
      PropTypes.number,
    showHeader:
      PropTypes.bool,
    showSidebar:
      PropTypes.bool,
  };

DashboardSkeleton.defaultProps =
  {
    stats: 4,
    charts: 2,
    groups: 6,
    showHeader: true,
    showSidebar: false,
  };

// ============================================================================
// Export
// ============================================================================

export default memo(
  DashboardSkeleton
);

export {
  StatCardSkeleton,
  ChartSkeleton,
  GroupCardSkeleton,
};