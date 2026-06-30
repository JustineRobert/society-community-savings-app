// ============================================================================
// TITech Community Capital
// Enterprise Dashboard Statistics
// File: frontend/src/pages/dashboard/DashboardStats.jsx
// Production Grade
// Multi-Tenant | Realtime | Analytics Ready
// ============================================================================

import React, {
  memo,
  useMemo,
} from "react";

import {
  Users,
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Building2,
  Smartphone,
  DollarSign,
} from "lucide-react";

import {
  StatCard,
  Card,
  FeatureGate,
} from "../../ui";

import "./DashboardStats.css";

// ============================================================================
// Helpers
// ============================================================================

const formatCurrency = (
  amount = 0
) =>
  new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(amount);

const formatPercentage = (
  value = 0
) =>
  `${Number(value).toFixed(
    1
  )}%`;

function calculateTrend(
  current = 0,
  previous = 0
) {
  if (!previous) {
    return 0;
  }

  return (
    ((current - previous) /
      previous) *
    100
  );
}

// ============================================================================
// Trend Badge
// ============================================================================

function TrendBadge({
  value = 0,
}) {
  const positive =
    value >= 0;

  return (
    <div
      className={`dashboard-trend ${
        positive
          ? "positive"
          : "negative"
      }`}
    >
      {positive ? (
        <TrendingUp
          size={14}
        />
      ) : (
        <TrendingDown
          size={14}
        />
      )}

      <span>
        {formatPercentage(
          Math.abs(value)
        )}
      </span>
    </div>
  );
}

// ============================================================================
// Dashboard Stats
// ============================================================================

function DashboardStats({
  metrics = {},
  previousMetrics = {},
  loading = false,
  tenant = null,
}) {
  // ===========================================================================
  // Statistics
  // ===========================================================================

  const stats =
    useMemo(() => {
      const savingsTrend =
        calculateTrend(
          metrics.totalSavings,
          previousMetrics.totalSavings
        );

      const membersTrend =
        calculateTrend(
          metrics.totalMembers,
          previousMetrics.totalMembers
        );

      const loansTrend =
        calculateTrend(
          metrics.activeLoans,
          previousMetrics.activeLoans
        );

      const groupsTrend =
        calculateTrend(
          metrics.totalGroups,
          previousMetrics.totalGroups
        );

      return [
        {
          key:
            "totalSavings",
          title:
            "Total Savings",
          icon:
            PiggyBank,
          value:
            formatCurrency(
              metrics.totalSavings
            ),
          trend:
            savingsTrend,
        },
        {
          key:
            "groups",
          title:
            "Groups",
          icon:
            Building2,
          value:
            metrics.totalGroups ||
            0,
          trend:
            groupsTrend,
        },
        {
          key:
            "members",
          title:
            "Members",
          icon: Users,
          value:
            metrics.totalMembers ||
            0,
          trend:
            membersTrend,
        },
        {
          key:
            "loans",
          title:
            "Active Loans",
          icon:
            CreditCard,
          value:
            metrics.activeLoans ||
            0,
          trend:
            loansTrend,
        },
      ];
    }, [
      metrics,
      previousMetrics,
    ]);

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="dashboard-stats-grid">
        {[1, 2, 3, 4].map(
          item => (
            <Card
              key={item}
              className="dashboard-stat-skeleton"
            >
              <div className="skeleton-icon" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </Card>
          )
        )}
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <>
      {/* =============================================================== */}
      {/* Core Statistics */}
      {/* =============================================================== */}

      <div className="dashboard-stats-grid">
        {stats.map(
          stat => {
            const Icon =
              stat.icon;

            return (
              <Card
                key={
                  stat.key
                }
                className="dashboard-stat-card"
              >
                <div className="dashboard-stat-header">
                  <div className="dashboard-stat-icon">
                    <Icon
                      size={
                        22
                      }
                    />
                  </div>

                  <TrendBadge
                    value={
                      stat.trend
                    }
                  />
                </div>

                <div className="dashboard-stat-body">
                  <h4>
                    {
                      stat.title
                    }
                  </h4>

                  <h2>
                    {
                      stat.value
                    }
                  </h2>
                </div>
              </Card>
            );
          }
        )}
      </div>

      {/* =============================================================== */}
      {/* Executive Statistics */}
      {/* =============================================================== */}

      <FeatureGate features="executive_dashboard">
        <div className="dashboard-stats-grid executive">
          <Card className="dashboard-stat-card">
            <div className="dashboard-stat-header">
              <DollarSign
                size={22}
              />
            </div>

            <div className="dashboard-stat-body">
              <h4>
                Portfolio
                Value
              </h4>

              <h2>
                {formatCurrency(
                  metrics.portfolioValue
                )}
              </h2>
            </div>
          </Card>

          <Card className="dashboard-stat-card">
            <div className="dashboard-stat-header">
              <Wallet
                size={22}
              />
            </div>

            <div className="dashboard-stat-body">
              <h4>
                Revenue
              </h4>

              <h2>
                {formatCurrency(
                  metrics.revenue
                )}
              </h2>
            </div>
          </Card>
        </div>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Mobile Money */}
      {/* =============================================================== */}

      <FeatureGate features="mobile_money">
        <div className="dashboard-stats-grid">
          <Card className="dashboard-stat-card">
            <div className="dashboard-stat-header">
              <Smartphone
                size={22}
              />
            </div>

            <div className="dashboard-stat-body">
              <h4>
                MoMo Volume
              </h4>

              <h2>
                {formatCurrency(
                  metrics.mobileMoneyVolume
                )}
              </h2>
            </div>
          </Card>
        </div>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Fraud Detection */}
      {/* =============================================================== */}

      <FeatureGate features="fraud_detection">
        <div className="dashboard-stats-grid">
          <Card className="dashboard-stat-card warning">
            <div className="dashboard-stat-header">
              <AlertTriangle
                size={22}
              />
            </div>

            <div className="dashboard-stat-body">
              <h4>
                Flagged
                Transactions
              </h4>

              <h2>
                {metrics.flaggedTransactions ||
                  0}
              </h2>
            </div>
          </Card>
        </div>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Tenant Information */}
      {/* =============================================================== */}

      {tenant && (
        <Card className="dashboard-tenant-card">
          <div className="dashboard-tenant-header">
            <Building2
              size={20}
            />

            <h3>
              {
                tenant.name
              }
            </h3>
          </div>

          <div className="dashboard-tenant-details">
            <div>
              <span>
                Plan
              </span>

              <strong>
                {tenant.plan ||
                  "Standard"}
              </strong>
            </div>

            <div>
              <span>
                Features
              </span>

              <strong>
                {tenant
                  ?.features
                  ?.length ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                Status
              </span>

              <strong>
                {tenant.status ||
                  "Active"}
              </strong>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

export default memo(
  DashboardStats
);