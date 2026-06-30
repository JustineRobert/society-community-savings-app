// ============================================================================
// TITech Community Capital
// Group List
// File: frontend/src/pages/dashboard/GroupList.jsx
// Production Grade
// Multi-Tenant | Search | Filters | Pagination | Real-time Ready
// ============================================================================

import React, {
  memo,
  useMemo,
  useState,
  useCallback,
} from "react";

import PropTypes from "prop-types";
import {
  Search,
  Users,
  Calendar,
  PiggyBank,
  ArrowRight,
  Building2,
  Filter,
  RefreshCw,
} from "lucide-react";

import {
  Card,
  Button,
  Input,
  StatusBadge,
  Pagination,
  Skeleton,
  EmptyState,
} from "../../ui";

import "./GroupList.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 12;

const STATUS_COLORS = {
  active: "success",
  suspended: "danger",
  inactive: "warning",
  pending: "warning",
};

// ============================================================================
// Helpers
// ============================================================================

const formatCurrency = (
  amount
) =>
  new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(amount || 0)
  );

const formatDate = (
  value
) => {
  if (!value) return "N/A";

  try {
    return new Date(
      value
    ).toLocaleDateString(
      "en-UG"
    );
  } catch {
    return "N/A";
  }
};

// ============================================================================
// Group Card
// ============================================================================

const GroupCard = memo(
  ({
    group,
    onOpen,
  }) => {
    const members =
      group?.memberCount ||
      group?.members?.length ||
      0;

    return (
      <Card className="group-card">
        <div className="group-card-header">
          <div className="group-avatar">
            <Building2
              size={22}
            />
          </div>

          <StatusBadge
            status={
              STATUS_COLORS[
                group.status
              ] ||
              "success"
            }
          >
            {group.status ||
              "active"}
          </StatusBadge>
        </div>

        <h3>
          {group.name}
        </h3>

        <p className="group-description">
          {group.description ||
            "No description available."}
        </p>

        <div className="group-meta">
          <div>
            <Users
              size={16}
            />
            <span>
              {members} Members
            </span>
          </div>

          <div>
            <PiggyBank
              size={16}
            />
            <span>
              {formatCurrency(
                group.totalContributions
              )}
            </span>
          </div>

          <div>
            <Calendar
              size={16}
            />
            <span>
              {formatDate(
                group.nextContributionDate
              )}
            </span>
          </div>
        </div>

        <Button
          className="group-open-btn"
          onClick={() =>
            onOpen(group)
          }
        >
          Open Group
          <ArrowRight
            size={16}
          />
        </Button>
      </Card>
    );
  }
);

// ============================================================================
// Main Component
// ============================================================================

function GroupList({
  groups = [],
  loading = false,
  onOpenGroup,
  onRefresh,
}) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    page,
    setPage,
  ] = useState(1);

  // ==========================================================================
  // Filtering
  // ==========================================================================

  const filteredGroups =
    useMemo(() => {
      return groups.filter(
        (group) => {
          const matchesSearch =
            !search ||
            group.name
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            group.description
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            group.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      groups,
      search,
      statusFilter,
    ]);

  // ==========================================================================
  // Pagination
  // ==========================================================================

  const totalPages =
    Math.ceil(
      filteredGroups.length /
        PAGE_SIZE
    ) || 1;

  const paginatedGroups =
    useMemo(() => {
      const start =
        (page - 1) *
        PAGE_SIZE;

      return filteredGroups.slice(
        start,
        start +
          PAGE_SIZE
      );
    }, [
      filteredGroups,
      page,
    ]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleOpen =
    useCallback(
      (group) => {
        onOpenGroup?.(
          group
        );
      },
      [onOpenGroup]
    );

  // ==========================================================================
  // Loading
  // ==========================================================================

  if (loading) {
    return (
      <div className="group-grid">
        {Array.from({
          length: 6,
        }).map(
          (_, index) => (
            <Skeleton
              key={
                index
              }
              height={
                260
              }
            />
          )
        )}
      </div>
    );
  }

  // ==========================================================================
  // Empty State
  // ==========================================================================

  if (!groups.length) {
    return (
      <EmptyState
        title="No Groups Found"
        description="No savings groups are currently available."
      />
    );
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="group-list">
      {/* =============================================================== */}
      {/* Toolbar */}
      {/* =============================================================== */}

      <div className="group-toolbar">
        <div className="group-search">
          <Search
            size={18}
          />

          <Input
            placeholder="Search groups..."
            value={
              search
            }
            onChange={(
              e
            ) =>
              setSearch(
                e.target
                  .value
              )
            }
          />
        </div>

        <div className="group-actions">
          <div className="group-filter">
            <Filter
              size={16}
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                e
              ) =>
                setStatusFilter(
                  e.target
                    .value
                )
              }
            >
              <option value="all">
                All
              </option>

              <option value="active">
                Active
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="inactive">
                Inactive
              </option>

              <option value="suspended">
                Suspended
              </option>
            </select>
          </div>

          {onRefresh && (
            <Button
              variant="secondary"
              onClick={
                onRefresh
              }
            >
              <RefreshCw
                size={16}
              />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* =============================================================== */}
      {/* Summary */}
      {/* =============================================================== */}

      <div className="group-summary">
        <span>
          Showing{" "}
          <strong>
            {
              filteredGroups.length
            }
          </strong>{" "}
          groups
        </span>
      </div>

      {/* =============================================================== */}
      {/* Grid */}
      {/* =============================================================== */}

      <div className="group-grid">
        {paginatedGroups.map(
          (group) => (
            <GroupCard
              key={
                group._id ||
                group.id
              }
              group={
                group
              }
              onOpen={
                handleOpen
              }
            />
          )
        )}
      </div>

      {/* =============================================================== */}
      {/* Pagination */}
      {/* =============================================================== */}

      {totalPages >
        1 && (
        <Pagination
          page={page}
          totalPages={
            totalPages
          }
          onChange={
            setPage
          }
        />
      )}
    </div>
  );
}

// ============================================================================
// Prop Types
// ============================================================================

GroupList.propTypes = {
  groups:
    PropTypes.array,
  loading:
    PropTypes.bool,
  onOpenGroup:
    PropTypes.func,
  onRefresh:
    PropTypes.func,
};

export default memo(
  GroupList
);