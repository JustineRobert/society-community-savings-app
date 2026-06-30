// ============================================================================
// TITech Community Capital
// Enterprise Dashboard
// File: frontend/src/pages/dashboard/Dashboard.jsx
// Production Grade
// Multi-Tenant | Real-Time | Executive Analytics | Feature Flags
// ============================================================================

import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  RefreshCw,
  Bell,
  Wifi,
  WifiOff,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { toast } from "react-toastify";

import { useAuth } from "../../context/AuthContext";
import useDashboardData from "../../hooks/useDashboardData";
import useRealtimeDashboard from "../../hooks/useRealtimeDashboard";

import FeatureGate from "../../components/FeatureGate";
import PermissionGate from "../../components/PermissionGate";

import {
  PageHeader,
  StatCard,
  LoadingScreen,
  Card,
  Button,
} from "../../ui";

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(
  value = 0
) {
  return new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatDate(
  date
) {
  if (!date) {
    return "Never";
  }

  return new Date(
    date
  ).toLocaleString();
}

// ============================================================================
// Dashboard
// ============================================================================

export default function Dashboard() {
  const navigate =
    useNavigate();

  const {
    user,
    tenant,
    logout,
  } = useAuth();

  const [
    refreshLoading,
    setRefreshLoading,
  ] = useState(false);

  // ===========================================================================
  // Dashboard Data
  // ===========================================================================

  const {
    loading,
    error,
    groups,
    stats,
    metrics,
    refresh,
    lastUpdated,
    notifications,
    systemHealth,
  } = useDashboardData({
    autoRefresh: true,
    realtime: true,
    isAdmin:
      user?.role ===
        "admin" ||
      user?.role ===
        "super_admin",

    enableExecutive: true,
    enableFraud: true,
    enableRegulatory: true,
    enableMobileMoney: true,
  });

  const realtime =
    useRealtimeDashboard();

  // ===========================================================================
  // Role Checks
  // ===========================================================================

  const isAdmin =
    useMemo(
      () =>
        [
          "admin",
          "super_admin",
        ].includes(
          user?.role
        ),
      [user]
    );

  // ===========================================================================
  // Refresh
  // ===========================================================================

  const handleRefresh =
    useCallback(
      async () => {
        try {
          setRefreshLoading(
            true
          );

          await refresh();

          toast.success(
            "Dashboard updated."
          );
        } catch {
          toast.error(
            "Failed to refresh dashboard."
          );
        } finally {
          setRefreshLoading(
            false
          );
        }
      },
      [refresh]
    );

  // ===========================================================================
  // Logout
  // ===========================================================================

  const handleLogout =
    useCallback(
      async () => {
        try {
          await logout();

          navigate(
            "/login"
          );
        } catch {
          toast.error(
            "Logout failed."
          );
        }
      },
      [logout, navigate]
    );

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <LoadingScreen message="Loading dashboard..." />
    );
  }

  // ===========================================================================
  // Error
  // ===========================================================================

  if (error) {
    return (
      <div className="dashboard-error">
        <AlertTriangle
          size={48}
        />

        <h2>
          Failed to load
          dashboard
        </h2>

        <p>
          {error.message}
        </p>

        <Button
          onClick={
            handleRefresh
          }
        >
          Retry
        </Button>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="dashboard-page">
      {/* =============================================================== */}
      {/* Header */}
      {/* =============================================================== */}

      <PageHeader
        title={`Welcome ${user?.name || ""}`}
        subtitle={
          tenant?.name ||
          "TITech Community Capital"
        }
      >
        <div className="dashboard-header-actions">
          <Button
            onClick={
              handleRefresh
            }
            disabled={
              refreshLoading
            }
          >
            <RefreshCw
              size={18}
            />
          </Button>

          <Button>
            <Bell
              size={18}
            />
            {notifications
              ?.length >
              0 && (
              <span>
                {
                  notifications.length
                }
              </span>
            )}
          </Button>

          <Button>
            {realtime.connected ? (
              <Wifi
                size={18}
              />
            ) : (
              <WifiOff
                size={18}
              />
            )}
          </Button>

          <Button
            onClick={
              handleLogout
            }
          >
            <LogOut
              size={18}
            />
          </Button>
        </div>
      </PageHeader>

      {/* =============================================================== */}
      {/* KPI Cards */}
      {/* =============================================================== */}

      <div className="dashboard-stats-grid">
        <StatCard
          title="Savings"
          value={formatCurrency(
            metrics.totalSavings
          )}
        />

        <StatCard
          title="Groups"
          value={
            metrics.totalGroups
          }
        />

        <StatCard
          title="Members"
          value={
            metrics.totalMembers
          }
        />

        <StatCard
          title="Active Loans"
          value={
            metrics.activeLoans
          }
        />
      </div>

      {/* =============================================================== */}
      {/* Executive Dashboard */}
      {/* =============================================================== */}

      <FeatureGate features="executive_dashboard">
        <Card>
          <h2>
            Executive
            Analytics
          </h2>

          <div className="dashboard-grid">
            <div>
              Portfolio Value
            </div>

            <strong>
              {formatCurrency(
                stats
                  ?.executive
                  ?.portfolioValue
              )}
            </strong>

            <div>
              Total Revenue
            </div>

            <strong>
              {formatCurrency(
                stats
                  ?.executive
                  ?.revenue
              )}
            </strong>

            <div>
              Loan Recovery
            </div>

            <strong>
              {stats
                ?.executive
                ?.recoveryRate ||
                0}
              %
            </strong>
          </div>
        </Card>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Mobile Money */}
      {/* =============================================================== */}

      <FeatureGate features="mobile_money">
        <Card>
          <h2>
            Mobile Money
          </h2>

          <div className="dashboard-grid">
            <div>
              Deposits
            </div>

            <strong>
              {formatCurrency(
                stats
                  ?.mobileMoney
                  ?.deposits
              )}
            </strong>

            <div>
              Withdrawals
            </div>

            <strong>
              {formatCurrency(
                stats
                  ?.mobileMoney
                  ?.withdrawals
              )}
            </strong>
          </div>
        </Card>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Fraud */}
      {/* =============================================================== */}

      <FeatureGate features="fraud_detection">
        <Card>
          <h2>
            Fraud Monitoring
          </h2>

          <div>
            Flagged
            Transactions:
            {" "}
            <strong>
              {stats
                ?.fraud
                ?.flagged ||
                0}
            </strong>
          </div>
        </Card>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Regulatory */}
      {/* =============================================================== */}

      <FeatureGate features="regulatory_reporting">
        <Card>
          <h2>
            Regulatory
            Reporting
          </h2>

          <div>
            Pending
            Reports:
            {" "}
            <strong>
              {stats
                ?.regulatory
                ?.pending ||
                0}
            </strong>
          </div>
        </Card>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Groups */}
      {/* =============================================================== */}

      <Card>
        <h2>
          Community Groups
        </h2>

        {groups.length ===
        0 ? (
          <p>
            No groups
            available.
          </p>
        ) : (
          <div className="groups-grid">
            {groups.map(
              group => (
                <Card
                  key={
                    group._id
                  }
                  onClick={() =>
                    navigate(
                      `/groups/${group._id}`
                    )
                  }
                >
                  <h3>
                    {
                      group.name
                    }
                  </h3>

                  <p>
                    {
                      group.description
                    }
                  </p>

                  <small>
                    Members:
                    {" "}
                    {group
                      ?.members
                      ?.length ||
                      0}
                  </small>

                  <br />

                  <small>
                    Contributions:
                    {" "}
                    {formatCurrency(
                      group.totalContributions
                    )}
                  </small>
                </Card>
              )
            )}
          </div>
        )}
      </Card>

      {/* =============================================================== */}
      {/* System Health */}
      {/* =============================================================== */}

      <PermissionGate permissions="view_system_health">
        <Card>
          <h2>
            System Health
          </h2>

          <div>
            API:
            {" "}
            <strong>
              {systemHealth.api ||
                "Healthy"}
            </strong>
          </div>

          <div>
            Database:
            {" "}
            <strong>
              {systemHealth.database ||
                "Healthy"}
            </strong>
          </div>

          <div>
            Socket:
            {" "}
            <strong>
              {realtime.connected
                ? "Connected"
                : "Disconnected"}
            </strong>
          </div>

          <div>
            Last Updated:
            {" "}
            <strong>
              {formatDate(
                lastUpdated
              )}
            </strong>
          </div>
        </Card>
      </PermissionGate>
    </div>
  );
}