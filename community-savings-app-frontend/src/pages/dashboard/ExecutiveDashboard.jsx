// ============================================================================
// TITech Community Capital
// Executive Dashboard
// File: frontend/src/pages/dashboard/ExecutiveDashboard.jsx
// Production Grade
// Multi-Tenant | Executive Analytics | Board Reporting
// ============================================================================

import React, {
  memo,
  useMemo,
} from "react";

import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  CreditCard,
  DollarSign,
  Download,
  Landmark,
  PieChart as PieChartIcon,
  ShieldAlert,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  BarChart,
  Bar,
} from "recharts";

import {
  Card,
  Button,
  StatusBadge,
} from "../../ui";

import "./ExecutiveDashboard.css";

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
];

const defaultMetrics = {
  totalAssets: 0,
  totalLiabilities: 0,
  totalSavings: 0,
  loanPortfolio: 0,
  revenue: 0,
  expenses: 0,
  profit: 0,
  activeMembers: 0,
  activeGroups: 0,
  recoveryRate: 0,
  defaultRate: 0,
  mobileMoneyVolume: 0,
};

// ============================================================================
// Helpers
// ============================================================================

const money = (
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

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  negative = false,
}) {
  return (
    <Card className="executive-metric-card">
      <div className="executive-metric-header">
        <div>
          <p>{title}</p>
          <h3>{value}</h3>
        </div>

        <div className="executive-icon">
          <Icon size={24} />
        </div>
      </div>

      {trend !==
        undefined && (
        <div
          className={`executive-trend ${
            negative
              ? "negative"
              : "positive"
          }`}
        >
          {negative ? (
            <TrendingDown
              size={14}
            />
          ) : (
            <TrendingUp
              size={14}
            />
          )}

          <span>
            {trend}%
          </span>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Executive Dashboard
// ============================================================================

function ExecutiveDashboard({
  metrics = {},
  portfolioHistory = [],
  revenueHistory = [],
  savingsBreakdown = [],
  loanPerformance = [],
  riskMetrics = {},
  strategicKPIs = {},
  onExportBoardReport,
  onExportFinancials,
}) {
  const data =
    useMemo(
      () => ({
        ...defaultMetrics,
        ...metrics,
      }),
      [metrics]
    );

  return (
    <div className="executive-dashboard">
      {/* =============================================================== */}
      {/* Header */}
      {/* =============================================================== */}

      <section className="executive-header">
        <div>
          <h1>
            Executive
            Dashboard
          </h1>

          <p>
            Strategic
            performance,
            portfolio
            analytics and
            board-level
            insights.
          </p>
        </div>

        <div className="executive-actions">
          <Button
            onClick={
              onExportBoardReport
            }
          >
            <Download
              size={16}
            />
            Board Report
          </Button>

          <Button
            variant="secondary"
            onClick={
              onExportFinancials
            }
          >
            <Download
              size={16}
            />
            Financials
          </Button>
        </div>
      </section>

      {/* =============================================================== */}
      {/* Metrics */}
      {/* =============================================================== */}

      <section className="executive-metrics-grid">
        <MetricCard
          title="Assets"
          value={money(
            data.totalAssets
          )}
          icon={Landmark}
        />

        <MetricCard
          title="Liabilities"
          value={money(
            data.totalLiabilities
          )}
          icon={
            AlertTriangle
          }
        />

        <MetricCard
          title="Revenue"
          value={money(
            data.revenue
          )}
          icon={DollarSign}
          trend={
            strategicKPIs.revenueGrowth
          }
        />

        <MetricCard
          title="Profit"
          value={money(
            data.profit
          )}
          icon={Banknote}
          trend={
            strategicKPIs.profitGrowth
          }
        />

        <MetricCard
          title="Loan Portfolio"
          value={money(
            data.loanPortfolio
          )}
          icon={CreditCard}
        />

        <MetricCard
          title="Savings"
          value={money(
            data.totalSavings
          )}
          icon={Wallet}
        />

        <MetricCard
          title="Members"
          value={
            data.activeMembers.toLocaleString()
          }
          icon={Users}
        />

        <MetricCard
          title="Groups"
          value={
            data.activeGroups.toLocaleString()
          }
          icon={Building2}
        />

        <MetricCard
          title="Mobile Money"
          value={money(
            data.mobileMoneyVolume
          )}
          icon={Smartphone}
        />
      </section>

      {/* =============================================================== */}
      {/* Charts */}
      {/* =============================================================== */}

      <section className="executive-chart-grid">
        {/* Portfolio Growth */}

        <Card className="executive-chart-card">
          <div className="executive-chart-header">
            <h3>
              Portfolio
              Growth
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
                portfolioHistory
              }
            >
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
                fill="#dbeafe"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue */}

        <Card className="executive-chart-card">
          <div className="executive-chart-header">
            <h3>
              Revenue Trend
            </h3>

            <DollarSign
              size={20}
            />
          </div>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <LineChart
              data={
                revenueHistory
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="value"
                stroke="#16a34a"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Savings Mix */}

        <Card className="executive-chart-card">
          <div className="executive-chart-header">
            <h3>
              Savings Mix
            </h3>

            <PieChartIcon
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
                  savingsBreakdown
                }
                dataKey="value"
                outerRadius={
                  110
                }
                label
              >
                {savingsBreakdown.map(
                  (
                    item,
                    index
                  ) => (
                    <Cell
                      key={
                        index
                      }
                      fill={
                        COLORS[
                          index %
                            COLORS.length
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

        {/* Loan Performance */}

        <Card className="executive-chart-card">
          <div className="executive-chart-header">
            <h3>
              Loan
              Performance
            </h3>

            <CreditCard
              size={20}
            />
          </div>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={
                loanPerformance
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="value"
                fill="#2563eb"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* =============================================================== */}
      {/* Risk & Governance */}
      {/* =============================================================== */}

      <section className="executive-risk-grid">
        <Card className="executive-risk-card">
          <div className="executive-chart-header">
            <h3>
              Risk &
              Governance
            </h3>

            <ShieldAlert
              size={20}
            />
          </div>

          <div className="executive-risk-metrics">
            <div>
              <span>
                Recovery
                Rate
              </span>

              <strong>
                {
                  data.recoveryRate
                }
                %
              </strong>
            </div>

            <div>
              <span>
                Default
                Rate
              </span>

              <strong>
                {
                  data.defaultRate
                }
                %
              </strong>
            </div>

            <div>
              <span>
                Fraud
                Alerts
              </span>

              <strong>
                {riskMetrics.fraudAlerts ||
                  0}
              </strong>
            </div>

            <div>
              <span>
                AML Cases
              </span>

              <strong>
                {riskMetrics.amlCases ||
                  0}
              </strong>
            </div>
          </div>
        </Card>

        <Card className="executive-risk-card">
          <div className="executive-chart-header">
            <h3>
              Board Status
            </h3>

            <ArrowUpRight
              size={20}
            />
          </div>

          <div className="executive-status-list">
            <div>
              <span>
                Financial
                Health
              </span>

              <StatusBadge status="success">
                Strong
              </StatusBadge>
            </div>

            <div>
              <span>
                Liquidity
              </span>

              <StatusBadge status="success">
                Healthy
              </StatusBadge>
            </div>

            <div>
              <span>
                Regulatory
              </span>

              <StatusBadge status="warning">
                Review
              </StatusBadge>
            </div>

            <div>
              <span>
                Risk
              </span>

              <StatusBadge status="success">
                Controlled
              </StatusBadge>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

export default memo(
  ExecutiveDashboard
);