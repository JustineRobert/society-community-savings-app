// ============================================================================
// TITech Community Capital
// Enterprise Dashboard Widgets
// File: frontend/src/pages/dashboard/DashboardWidgets.jsx
// Production Grade
// Multi-Tenant | Realtime | Feature Flags | Executive Analytics
// ============================================================================

import React, {
  memo,
  useMemo,
} from "react";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  PiggyBank,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import {
  Card,
  FeatureGate,
  PermissionGate,
  StatusBadge,
  Button,
} from "../../ui";

import "./DashboardWidgets.css";

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
  ).format(
    Number(amount || 0)
  );

const formatDate = (
  date
) => {
  if (!date) {
    return "N/A";
  }

  return new Date(
    date
  ).toLocaleString();
};

// ============================================================================
// Widget Card
// ============================================================================

function WidgetCard({
  title,
  icon: Icon,
  children,
  actions,
  className = "",
}) {
  return (
    <Card
      className={`dashboard-widget-card ${className}`}
    >
      <div className="dashboard-widget-header">
        <div className="dashboard-widget-title">
          {Icon && (
            <Icon
              size={20}
            />
          )}

          <h3>{title}</h3>
        </div>

        {actions}
      </div>

      <div className="dashboard-widget-body">
        {children}
      </div>
    </Card>
  );
}

// ============================================================================
// Dashboard Widgets
// ============================================================================

function DashboardWidgets({
  metrics = {},
  notifications = [],
  activities = [],
  upcomingEvents = [],
  systemHealth = {},
  executive = {},
  mobileMoney = {},
  fraud = {},
  regulatory = {},
  onViewAllNotifications,
  onViewAllActivities,
  onExportReports,
}) {
  const recentNotifications =
    useMemo(
      () =>
        notifications.slice(
          0,
          5
        ),
      [notifications]
    );

  const recentActivities =
    useMemo(
      () =>
        activities.slice(
          0,
          5
        ),
      [activities]
    );

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="dashboard-widgets-grid">
      {/* =============================================================== */}
      {/* Notifications */}
      {/* =============================================================== */}

      <WidgetCard
        title="Notifications"
        icon={Activity}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={
              onViewAllNotifications
            }
          >
            View All
          </Button>
        }
      >
        {recentNotifications
          .length ===
        0 ? (
          <p>
            No notifications.
          </p>
        ) : (
          <ul className="dashboard-widget-list">
            {recentNotifications.map(
              (
                notification,
                index
              ) => (
                <li
                  key={
                    notification.id ||
                    index
                  }
                >
                  <p>
                    {
                      notification.title
                    }
                  </p>

                  <small>
                    {formatDate(
                      notification.createdAt
                    )}
                  </small>
                </li>
              )
            )}
          </ul>
        )}
      </WidgetCard>

      {/* =============================================================== */}
      {/* Activity Feed */}
      {/* =============================================================== */}

      <WidgetCard
        title="Recent Activity"
        icon={TrendingUp}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={
              onViewAllActivities
            }
          >
            View All
          </Button>
        }
      >
        {recentActivities
          .length ===
        0 ? (
          <p>
            No recent activity.
          </p>
        ) : (
          <ul className="dashboard-widget-list">
            {recentActivities.map(
              (
                item,
                index
              ) => (
                <li
                  key={
                    item.id ||
                    index
                  }
                >
                  <p>
                    {
                      item.message
                    }
                  </p>

                  <small>
                    {formatDate(
                      item.createdAt
                    )}
                  </small>
                </li>
              )
            )}
          </ul>
        )}
      </WidgetCard>

      {/* =============================================================== */}
      {/* Upcoming Events */}
      {/* =============================================================== */}

      <WidgetCard
        title="Upcoming Events"
        icon={Calendar}
      >
        {upcomingEvents
          .length ===
        0 ? (
          <p>
            No upcoming events.
          </p>
        ) : (
          <ul className="dashboard-widget-list">
            {upcomingEvents.map(
              (
                event,
                index
              ) => (
                <li
                  key={
                    event.id ||
                    index
                  }
                >
                  <strong>
                    {
                      event.title
                    }
                  </strong>

                  <small>
                    {formatDate(
                      event.date
                    )}
                  </small>
                </li>
              )
            )}
          </ul>
        )}
      </WidgetCard>

      {/* =============================================================== */}
      {/* Executive Dashboard */}
      {/* =============================================================== */}

      <FeatureGate features="executive_dashboard">
        <WidgetCard
          title="Executive Overview"
          icon={DollarSign}
        >
          <div className="dashboard-widget-metrics">
            <div>
              <span>
                Portfolio
              </span>

              <strong>
                {formatCurrency(
                  executive.portfolioValue
                )}
              </strong>
            </div>

            <div>
              <span>
                Revenue
              </span>

              <strong>
                {formatCurrency(
                  executive.revenue
                )}
              </strong>
            </div>

            <div>
              <span>
                Recovery
              </span>

              <strong>
                {executive.recoveryRate ||
                  0}
                %
              </strong>
            </div>
          </div>
        </WidgetCard>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Mobile Money */}
      {/* =============================================================== */}

      <FeatureGate features="mobile_money">
        <WidgetCard
          title="Mobile Money"
          icon={Smartphone}
        >
          <div className="dashboard-widget-metrics">
            <div>
              <span>
                Deposits
              </span>

              <strong>
                {formatCurrency(
                  mobileMoney.deposits
                )}
              </strong>
            </div>

            <div>
              <span>
                Withdrawals
              </span>

              <strong>
                {formatCurrency(
                  mobileMoney.withdrawals
                )}
              </strong>
            </div>

            <div>
              <span>
                Transactions
              </span>

              <strong>
                {mobileMoney.transactions ||
                  0}
              </strong>
            </div>
          </div>
        </WidgetCard>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Fraud */}
      {/* =============================================================== */}

      <FeatureGate features="fraud_detection">
        <WidgetCard
          title="Fraud Monitoring"
          icon={
            AlertTriangle
          }
          className="warning"
        >
          <div className="dashboard-widget-metrics">
            <div>
              <span>
                Flagged
              </span>

              <strong>
                {fraud.flagged ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                Under Review
              </span>

              <strong>
                {fraud.review ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                Risk Score
              </span>

              <strong>
                {fraud.riskScore ||
                  0}
                %
              </strong>
            </div>
          </div>
        </WidgetCard>
      </FeatureGate>

      {/* =============================================================== */}
      {/* Regulatory */}
      {/* =============================================================== */}

      <FeatureGate features="regulatory_reporting">
        <WidgetCard
          title="Regulatory Reports"
          icon={FileText}
          actions={
            <Button
              size="sm"
              onClick={
                onExportReports
              }
            >
              Export
            </Button>
          }
        >
          <div className="dashboard-widget-metrics">
            <div>
              <span>
                Pending
              </span>

              <strong>
                {regulatory.pending ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                Submitted
              </span>

              <strong>
                {regulatory.submitted ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                Due Soon
              </span>

              <strong>
                {regulatory.dueSoon ||
                  0}
              </strong>
            </div>
          </div>
        </WidgetCard>
      </FeatureGate>

      {/* =============================================================== */}
      {/* System Health */}
      {/* =============================================================== */}

      <PermissionGate permissions="view_system_health">
        <WidgetCard
          title="System Health"
          icon={Activity}
        >
          <div className="dashboard-widget-health">
            <div>
              <span>
                API
              </span>

              <StatusBadge
                status={
                  systemHealth.api ||
                  "healthy"
                }
              />
            </div>

            <div>
              <span>
                Database
              </span>

              <StatusBadge
                status={
                  systemHealth.database ||
                  "healthy"
                }
              />
            </div>

            <div>
              <span>
                Queue
              </span>

              <StatusBadge
                status={
                  systemHealth.queue ||
                  "healthy"
                }
              />
            </div>

            <div>
              <span>
                Mobile Money
              </span>

              <StatusBadge
                status={
                  systemHealth.mobileMoney ||
                  "healthy"
                }
              />
            </div>
          </div>
        </WidgetCard>
      </PermissionGate>

      {/* =============================================================== */}
      {/* Quick Actions */}
      {/* =============================================================== */}

      <WidgetCard
        title="Quick Actions"
        icon={
          ArrowUpRight
        }
      >
        <div className="dashboard-widget-actions">
          <Button>
            <Users
              size={16}
            />
            Add Member
          </Button>

          <Button>
            <PiggyBank
              size={16}
            />
            Savings
          </Button>

          <Button>
            <CreditCard
              size={16}
            />
            New Loan
          </Button>

          <Button>
            <Wallet
              size={16}
            />
            Transactions
          </Button>

          <Button>
            <Building2
              size={16}
            />
            Groups
          </Button>
        </div>
      </WidgetCard>
    </div>
  );
}

export default memo(
  DashboardWidgets
);