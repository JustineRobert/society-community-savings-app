// frontend/src/pages/Dashboard.jsx
// ============================================================================
// TITech Community Capital
// Enterprise Dashboard
// File: src/pages/Dashboard.jsx
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
  useNavigate,
} from "react-router-dom";

import {
  AlertCircle,
  Bell,
  CreditCard,
  LogOut,
  Menu,
  PiggyBank,
  RefreshCw,
  Users,
  Wallet,
  X,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

// ============================================================================
// Constants
// ============================================================================

const AUTO_REFRESH_INTERVAL = 60000;

const DEFAULT_STATS = {
  savings: 0,
  loans: [],
  fraud: [
    {
      name: "Clean",
      value: 100,
    },
    {
      name: "Flagged",
      value: 0,
    },
  ],
  members: 0,
  activeLoans: 0,
  totalDisbursed: 0,
};

const FRAUD_COLORS = [
  "#10b981",
  "#ef4444",
];

// ============================================================================
// Skeleton
// ============================================================================

function GroupCardSkeleton() {
  return (
    <div className="group-card-skeleton">
      <div className="skeleton-title" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}

// ============================================================================
// KPI Card
// ============================================================================

function StatCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="stat-card">
      <Icon size={28} />

      <h3>{title}</h3>

      <p>{value}</p>
    </div>
  );
}

// ============================================================================
// Admin Analytics
// ============================================================================

function AdminDashboard({
  stats,
}) {
  const loanData =
    stats?.loans || [];

  const fraudData =
    stats?.fraud ||
    DEFAULT_STATS.fraud;

  return (
    <section className="admin-dashboard">
      <h2>
        Administration Analytics
      </h2>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>
            Loan Distribution
          </h3>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={loanData}
            >
              <XAxis
                dataKey="status"
              />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="count"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>
            Fraud Monitoring
          </h3>

          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <PieChart>
              <Pie
                data={fraudData}
                dataKey="value"
                outerRadius={100}
              >
                {fraudData.map(
                  (
                    entry,
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
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export default function Dashboard() {
  const navigate =
    useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const mountedRef =
    useRef(false);

  const refreshRef =
    useRef();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    groups,
    setGroups,
  ] = useState([]);

  const [
    stats,
    setStats,
  ] = useState(
    DEFAULT_STATS
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    retryCount,
    setRetryCount,
  ] = useState(0);

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    notifCount,
    setNotifCount,
  ] = useState(0);

  // ===========================================================================
  // Role
  // ===========================================================================

  const isAdmin =
    useMemo(() => {
      return [
        "admin",
        "ADMIN",
        "super_admin",
      ].includes(
        user?.role
      );
    }, [user]);

  // ===========================================================================
  // Formatters
  // ===========================================================================

  const formatCurrency =
    useCallback(
      (value) => {
        return new Intl.NumberFormat(
          "en-UG",
          {
            style:
              "currency",
            currency:
              "UGX",
            maximumFractionDigits: 0,
          }
        ).format(
          Number(
            value || 0
          )
        );
      },
      []
    );

  const formatDate =
    useCallback(
      (date) => {
        if (!date)
          return "N/A";

        try {
          return new Date(
            date
          ).toLocaleDateString();
        } catch {
          return "N/A";
        }
      },
      []
    );

  // ===========================================================================
  // API Calls
  // ===========================================================================

  const fetchGroups =
    useCallback(
      async () => {
        const response =
          await api.get(
            "/api/groups"
          );

        const data =
          response?.data ||
          response ||
          [];

        setGroups(
          Array.isArray(
            data
          )
            ? data
            : []
        );
      },
      []
    );

  const fetchStats =
    useCallback(
      async () => {
        if (!isAdmin)
          return;

        const response =
          await api.get(
            "/api/admin/stats"
          );

        setStats({
          ...DEFAULT_STATS,
          ...(response
            ?.data ||
            response),
        });
      },
      [isAdmin]
    );

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setError("");

          await Promise.all(
            [
              fetchGroups(),
              fetchStats(),
            ]
          );
        } catch (
          err
        ) {
          console.error(
            err
          );

          setError(
            err?.response
              ?.data
              ?.message ||
              "Failed to load dashboard."
          );
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        fetchGroups,
        fetchStats,
      ]
    );

  // ===========================================================================
  // Initialize
  // ===========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    loadDashboard();

    refreshRef.current =
      setInterval(
        loadDashboard,
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      mountedRef.current =
        false;

      clearInterval(
        refreshRef.current
      );
    };
  }, [
    loadDashboard,
  ]);

  // ===========================================================================
  // Notifications
  // ===========================================================================

  useEffect(() => {
    let cleanup;

    import(
      "../services/socket"
    )
      .then(
        ({
          default:
            socket,
        }) => {
          const handler =
            () =>
              setNotifCount(
                (
                  prev
                ) =>
                  prev +
                  1
              );

          socket.on(
            "notification",
            handler
          );

          cleanup =
            () =>
              socket.off(
                "notification",
                handler
              );
        }
      )
      .catch(() => {});

    return () => {
      cleanup?.();
    };
  }, []);

  // ===========================================================================
  // Logout
  // ===========================================================================

  const handleLogout =
    useCallback(
      async () => {
        try {
          await logout();

          navigate(
            "/login",
            {
              replace:
                true,
            }
          );
        } catch {
          toast.error(
            "Logout failed."
          );
        }
      },
      [
        logout,
        navigate,
      ]
    );

  // ===========================================================================
  // Retry
  // ===========================================================================

  const handleRetry =
    useCallback(
      async () => {
        if (
          retryCount >=
          3
        ) {
          toast.error(
            "Maximum retries reached."
          );
          return;
        }

        setRetryCount(
          (
            previous
          ) =>
            previous +
            1
        );

        await loadDashboard();
      },
      [
        retryCount,
        loadDashboard,
      ]
    );

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    );
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  if (!user) {
    return (
      <div className="dashboard-error">
        <AlertCircle
          size={48}
        />

        <h2>
          Authentication
          Required
        </h2>

        <button
          onClick={() =>
            navigate(
              "/login"
            )
          }
        >
          Login
        </button>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>
          Welcome,{" "}
          {user?.name}
        </h1>

        <div className="dashboard-actions">
          <button
            onClick={() =>
              setMenuOpen(
                !menuOpen
              )
            }
          >
            {menuOpen ? (
              <X />
            ) : (
              <Menu />
            )}
          </button>

          <button>
            <Bell />

            {notifCount >
              0 && (
              <span>
                {
                  notifCount
                }
              </span>
            )}
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          icon={
            PiggyBank
          }
          title="Savings"
          value={formatCurrency(
            stats.savings
          )}
        />

        <StatCard
          icon={Wallet}
          title="Groups"
          value={
            groups.length
          }
        />

        <StatCard
          icon={Users}
          title="Members"
          value={
            stats.members
          }
        />

        <StatCard
          icon={
            CreditCard
          }
          title="Active Loans"
          value={
            stats.activeLoans
          }
        />
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle />

          <p>{error}</p>

          <button
            onClick={
              handleRetry
            }
          >
            <RefreshCw />
            Retry
          </button>
        </div>
      )}

      {isAdmin && (
        <AdminDashboard
          stats={stats}
        />
      )}

      <section className="groups-section">
        <h2>
          Community Groups
        </h2>

        <div className="groups-grid">
          {groups.map(
            (
              group
            ) => (
              <div
                key={
                  group._id
                }
                className="group-card"
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

                <p>
                  {(
                    group
                      ?.members ||
                    []
                  ).length}{" "}
                  members
                </p>

                <p>
                  {formatCurrency(
                    group.totalContributions
                  )}
                </p>

                <p>
                  Next:
                  {" "}
                  {formatDate(
                    group.nextContributionDate
                  )}
                </p>
              </div>
            )
          )}
        </div>
      </section>

      <button
        className="logout-btn"
        onClick={
          handleLogout
        }
      >
        <LogOut />
        Logout
      </button>
    </div>
  );
}