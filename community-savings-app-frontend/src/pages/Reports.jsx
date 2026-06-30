// frontend/src/pages/Reports.jsx
// ============================================================================
// TITech Community Capital
// Reports & Analytics
// File: src/pages/Reports.jsx
// Production Grade
// ============================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  RefreshCw,
  AlertCircle,
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  Wallet,
  CreditCard,
  Calendar,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { toast } from "react-toastify";

import api from "../services/api";

import "./Reports.css";

// ============================================================================
// Constants
// ============================================================================

const AUTO_REFRESH_INTERVAL = 300000;

const REPORT_TYPES = [
  "portfolio",
  "financial",
  "members",
  "transactions",
  "loans",
  "savings",
  "compliance",
  "audit",
];

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(Number(value || 0));
}

// ============================================================================
// Statistics Card
// ============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
}) {
  return (
    <div className="report-stat-card">
      <div className="report-stat-icon">
        <Icon size={24} />
      </div>

      <div>
        <h4>{title}</h4>
        <p>{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ReportSkeleton() {
  return (
    <div className="report-skeleton">
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function Reports() {
  const mountedRef =
    useRef(false);

  const refreshRef =
    useRef();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [reportType, setReportType] =
    useState("portfolio");

  const [dateRange, setDateRange] =
    useState({
      from: "",
      to: "",
    });

  const [reportData, setReportData] =
    useState({
      summary: {
        members: 0,
        savings: 0,
        loans: 0,
        transactions: 0,
      },
      loans: [],
      savings: [],
      portfolio: [],
    });

  // ===========================================================================
  // Fetch Reports
  // ===========================================================================

  const fetchReports =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/api/reports/dashboard",
            {
              params: {
                reportType,
                from:
                  dateRange.from,
                to: dateRange.to,
              },
            }
          );

        const data =
          response?.data ||
          {};

        if (mountedRef.current) {
          setReportData({
            summary:
              data.summary ||
              {},
            loans:
              data.loans ||
              [],
            savings:
              data.savings ||
              [],
            portfolio:
              data.portfolio ||
              [],
          });
        }
      } catch (err) {
        console.error(err);

        if (mountedRef.current) {
          setError(
            err?.response?.data
              ?.message ||
              "Failed to load reports."
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, [
      reportType,
      dateRange,
    ]);

  // ===========================================================================
  // Initialize
  // ===========================================================================

  useEffect(() => {
    mountedRef.current = true;

    fetchReports();

    refreshRef.current =
      setInterval(
        fetchReports,
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      mountedRef.current = false;

      clearInterval(
        refreshRef.current
      );
    };
  }, [fetchReports]);

  // ===========================================================================
  // Export Report
  // ===========================================================================

  const exportReport =
    useCallback(
      async (format) => {
        try {
          await api.get(
            `/api/reports/export/${format}`,
            {
              params: {
                reportType,
                from:
                  dateRange.from,
                to: dateRange.to,
              },
            }
          );

          toast.success(
            `${format.toUpperCase()} export started.`
          );
        } catch {
          toast.error(
            "Unable to export report."
          );
        }
      },
      [
        reportType,
        dateRange,
      ]
    );

  // ===========================================================================
  // Summary
  // ===========================================================================

  const summary =
    useMemo(() => {
      return (
        reportData.summary ||
        {}
      );
    }, [reportData]);

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="reports-page">
        <ReportSkeleton />
        <ReportSkeleton />
        <ReportSkeleton />
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <h1>
            Reports &
            Analytics
          </h1>

          <p>
            Financial reporting,
            portfolio analytics,
            and regulatory
            reporting.
          </p>
        </div>

        <div className="report-export-actions">
          <button
            onClick={() =>
              exportReport(
                "pdf"
              )
            }
          >
            <Download
              size={16}
            />
            PDF
          </button>

          <button
            onClick={() =>
              exportReport(
                "excel"
              )
            }
          >
            <Download
              size={16}
            />
            Excel
          </button>

          <button
            onClick={() =>
              exportReport(
                "csv"
              )
            }
          >
            <Download
              size={16}
            />
            CSV
          </button>
        </div>
      </header>

      <section className="report-filters">
        <select
          value={reportType}
          onChange={(e) =>
            setReportType(
              e.target.value
            )
          }
        >
          {REPORT_TYPES.map(
            (type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            )
          )}
        </select>

        <input
          type="date"
          value={
            dateRange.from
          }
          onChange={(e) =>
            setDateRange(
              (
                previous
              ) => ({
                ...previous,
                from:
                  e.target
                    .value,
              })
            )
          }
        />

        <input
          type="date"
          value={
            dateRange.to
          }
          onChange={(e) =>
            setDateRange(
              (
                previous
              ) => ({
                ...previous,
                to:
                  e.target
                    .value,
              })
            )
          }
        />

        <button
          onClick={
            fetchReports
          }
        >
          <RefreshCw
            size={16}
          />
          Refresh
        </button>
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle />

          <p>{error}</p>
        </div>
      )}

      <section className="report-stats">
        <StatCard
          title="Members"
          value={
            summary.members ||
            0
          }
          icon={
            FileText
          }
        />

        <StatCard
          title="Savings"
          value={formatCurrency(
            summary.savings
          )}
          icon={Wallet}
        />

        <StatCard
          title="Loans"
          value={formatCurrency(
            summary.loans
          )}
          icon={
            CreditCard
          }
        />

        <StatCard
          title="Transactions"
          value={
            summary.transactions ||
            0
          }
          icon={
            TrendingUp
          }
        />
      </section>

      <section className="reports-charts">
        <div className="chart-card">
          <h3>
            Loan Portfolio
          </h3>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={
                reportData
                  .loans
              }
            >
              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="value"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>
            Savings
            Distribution
          </h3>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <PieChart>
              <Pie
                data={
                  reportData
                    .savings
                }
                dataKey="value"
                outerRadius={
                  100
                }
              >
                {(
                  reportData.savings ||
                  []
                ).map(
                  (
                    entry,
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
        </div>
      </section>

      <section className="report-cards">
        <div className="report-card">
          <BarChart3
            size={28}
          />

          <h3>
            Portfolio Report
          </h3>

          <p>
            Loan portfolio,
            delinquency,
            PAR and
            performance
            metrics.
          </p>
        </div>

        <div className="report-card">
          <Calendar
            size={28}
          />

          <h3>
            Regulatory
            Reports
          </h3>

          <p>
            Compliance,
            audit and
            statutory
            reporting.
          </p>
        </div>

        <div className="report-card">
          <TrendingUp
            size={28}
          />

          <h3>
            Executive
            Dashboard
          </h3>

          <p>
            Strategic KPIs,
            forecasts and
            analytics.
          </p>
        </div>
      </section>
    </div>
  );
}