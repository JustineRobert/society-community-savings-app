// ============================================================================
// TITech Community Capital
// Enterprise Admin Dashboard
// File: frontend/src/pages/dashboard/AdminDashboard.jsx
// Production Grade
// ============================================================================

import React, {
  memo,
  useMemo,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  DollarSign,
  FileText,
  Landmark,
  PiggyBank,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import {
  Card,
  FeatureGate,
  PermissionGate,
  StatusBadge,
} from "../../ui";

import "./AdminDashboard.css";

// ============================================================================
// Constants
// ============================================================================

const FRAUD_COLORS = [
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

const DEFAULT_METRICS = {
  totalMembers: 0,
  totalSavings: 0,
  totalLoans: 0,
  activeLoans: 0,
  loanPortfolio: 0,
  totalTransactions: 0,
  mobileMoneyVolume: 0,
  fraudCases: 0,
  regulatoryReports: 0,
};

const DEFAULT_FRAUD = [
  {
    name: "Clean",
    value: 100,
  },
  {
    name: "Flagged",
    value: 0,
  },
];

const currency = (
  value
) =>
  new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0)
  );

// ============================================================================
// KPI Card
// ============================================================================

function KPI({
  title,
  value,
  icon: Icon,
  trend,
}) {
  return (
    <Card className="admin-kpi">
      <div className="admin-kpi-top">
        <div>
          <p>{title}</p>
          <h3>{value}</h3>
        </div>

        <div className="admin-kpi-icon">
          <Icon size={26} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="admin-kpi-trend">
          <TrendingUp size={14} />
          <span>{trend}%</span>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Admin Dashboard
// ============================================================================

function AdminDashboard({
  metrics = {},
  savingsHistory = [],
  loanDistribution = [],
  transactionHistory = [],
  fraudMetrics = DEFAULT_FRAUD,
  systemHealth = {},
  executiveMetrics = {},
}) {
  const data =
    useMemo(
      () => ({
        ...DEFAULT_METRICS,
        ...metrics,
      }),
      [metrics]
    );

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="admin-dashboard">
      {/* ===================================================================== */}
      {/* KPIs */}
      {/* ===================================================================== */}

      <section className="admin-kpi-grid">
        <KPI
          title="Members"
          value={
            data.totalMembers.toLocaleString()
          }
          icon={Users}
          trend={
            executiveMetrics.memberGrowth
          }
        />

        <KPI
          title="Savings"
          value={currency(
            data.totalSavings
          )}
          icon={PiggyBank}
          trend={
            executiveMetrics.savingsGrowth
          }
        />

        <KPI
          title="Loan Portfolio"
          value={currency(
            data.loanPortfolio
          )}
          icon={CreditCard}
          trend={
            executiveMetrics.loanGrowth
          }
        />

        <KPI
          title="Transactions"
          value={
            data.totalTransactions.toLocaleString()
          }
          icon={Wallet}
          trend={
            executiveMetrics.transactionGrowth
          }
        />

        <FeatureGate features="mobile_money">
          <KPI
            title="Mobile Money"
            value={currency(
              data.mobileMoneyVolume
            )}
            icon={Smartphone}
          />
        </FeatureGate>

        <FeatureGate features="fraud_detection">
          <KPI
            title="Fraud Cases"
            value={
              data.fraudCases
            }
            icon={
              ShieldAlert
            }
          />
        </FeatureGate>
      </section>

      {/* ===================================================================== */}
      {/* Charts */}
      {/* ===================================================================== */}

      <section className="admin-chart-grid">
        {/* Savings Trend */}

        <Card className="admin-chart-card">
          <div className="admin-chart-header">
            <h3>
              Savings Trend
            </h3>

            <BarChart3
              size={20}
            />
          </div>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <AreaChart
              data={
                savingsHistory
              }
            >
              <defs>
                <linearGradient
                  id="savingsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#2563eb"
                    stopOpacity={
                      0.4
                    }
                  />
                  <stop
                    offset="100%"
                    stopColor="#2563eb"
                    stopOpacity={
                      0.05
                    }
                  />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                fill="url(#savingsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Loan Distribution */}

        <Card className="admin-chart-card">
          <div className="admin-chart-header">
            <h3>
              Loan Distribution
            </h3>

            <DollarSign
              size={20}
            />
          </div>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={
                loanDistribution
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="status"
              />

              <YAxis />

              <Tooltip />

              <Legend />

              <Bar
                dataKey="count"
                fill="#2563eb"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Transactions */}

        <Card className="admin-chart-card">
          <div className="admin-chart-header">
            <h3>
              Transaction Volume
            </h3>

            <Wallet
              size={20}
            />
          </div>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <AreaChart
              data={
                transactionHistory
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Area
                dataKey="value"
                stroke="#16a34a"
                fill="#dcfce7"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Fraud */}

        <FeatureGate features="fraud_detection">
          <Card className="admin-chart-card">
            <div className="admin-chart-header">
              <h3>
                Fraud Analytics
              </h3>

              <AlertTriangle
                size={20}
              />
            </div>

            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <PieChart>
                <Pie
                  data={
                    fraudMetrics ||
                    DEFAULT_FRAUD
                  }
                  outerRadius={
                    100
                  }
                  dataKey="value"
                  label
                >
                  {(fraudMetrics ||
                    DEFAULT_FRAUD).map(
                    (
                      item,
                      index
                    ) => (
                      <Cell
                        key={
                          index
                        }
                        fill={
                          FRAUD_COLORS[
                            index %
                              FRAUD_COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </FeatureGate>
      </section>

      {/* ===================================================================== */}
      {/* Executive Section */}
      {/* ===================================================================== */}

      <FeatureGate features="executive_dashboard">
        <Card className="executive-summary-card">
          <div className="admin-chart-header">
            <h3>
              Executive Summary
            </h3>

            <Landmark
              size={20}
            />
          </div>

          <div className="executive-summary-grid">
            <div>
              <span>
                Revenue
              </span>

              <strong>
                {currency(
                  executiveMetrics.revenue
                )}
              </strong>
            </div>

            <div>
              <span>
                Expenses
              </span>

              <strong>
                {currency(
                  executiveMetrics.expenses
                )}
              </strong>
            </div>

            <div>
              <span>
                Profit
              </span>

              <strong>
                {currency(
                  executiveMetrics.profit
                )}
              </strong>
            </div>

            <div>
              <span>
                Recovery Rate
              </span>

              <strong>
                {executiveMetrics.recoveryRate ||
                  0}
                %
              </strong>
            </div>
          </div>
        </Card>
      </FeatureGate>

      {/* ===================================================================== */}
      {/* Regulatory */}
      {/* ===================================================================== */}

      <FeatureGate features="regulatory_reporting">
        <Card className="regulatory-card">
          <div className="admin-chart-header">
            <h3>
              Regulatory Reporting
            </h3>

            <FileText
              size={20}
            />
          </div>

          <div className="regulatory-content">
            <div>
              <span>
                Pending Reports
              </span>

              <strong>
                {
                  data.regulatoryReports
                }
              </strong>
            </div>

            <StatusBadge status="warning">
              Action Required
            </StatusBadge>
          </div>
        </Card>
      </FeatureGate>

      {/* ===================================================================== */}
      {/* System Health */}
      {/* ===================================================================== */}

      <PermissionGate permissions="view_system_health">
        <Card className="system-health-card">
          <div className="admin-chart-header">
            <h3>
              System Health
            </h3>

            <Activity />
          </div>

          <div className="system-health-grid">
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
        </Card>
      </PermissionGate>
    </div>
  );
}

export default memo(
  AdminDashboard
);