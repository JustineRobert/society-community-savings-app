// ============================================================================
// TITech Community Capital
// Enterprise Dashboard
// Production Grade
// ============================================================================

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertCircle,
  Menu,
  X,
  LogOut,
  Plus,
  Users,
  RefreshCw,
  Bell,
  Wallet,
  PiggyBank,
  CreditCard,
} from 'lucide-react';

import { toast } from 'react-toastify';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

import api from '../services/api';
import { useAuth } from '../context/AuthContext';

import './Dashboard.css';

// ============================================================================
// SKELETON
// ============================================================================

const GroupCardSkeleton = () => (
  <div className="group-card-skeleton">
    <div className="skeleton-title" />
    <div className="skeleton-line" />
    <div className="skeleton-line" />
    <div className="skeleton-line" />
  </div>
);

// ============================================================================
// ADMIN ANALYTICS
// ============================================================================

function AdminDashboard({ stats }) {
  const loanData = stats?.loans || [];

  const fraudData =
    stats?.fraud || [
      { name: 'Clean', value: 100 },
      { name: 'Flagged', value: 0 },
    ];

  return (
    <section className="admin-dashboard">
      <h2>Administration Analytics</h2>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Loan Distribution</h3>

          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <BarChart data={loanData}>
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Fraud Monitoring</h3>

          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <PieChart>
              <Pie
                data={fraudData}
                dataKey="value"
                outerRadius={100}
              >
                {fraudData.map(
                  (entry, index) => (
                    <Cell
                      key={index}
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
// MAIN DASHBOARD
// ============================================================================

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const mountedRef = useRef(true);

  const [groups, setGroups] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [notifCount, setNotifCount] =
    useState(0);

  const [retryCount, setRetryCount] =
    useState(0);

  const [stats, setStats] =
    useState({
      savings: 0,
      loans: [],
      fraud: [],
      members: 0,
    });

  // ==========================================================================
  // ROLE
  // ==========================================================================

  const isAdmin = useMemo(
    () =>
      user?.role === 'admin' ||
      user?.role === 'ADMIN',
    [user]
  );

  // ==========================================================================
  // FORMATTERS
  // ==========================================================================

  const formatCurrency =
    useCallback((value) => {
      return new Intl.NumberFormat(
        'en-UG',
        {
          style: 'currency',
          currency: 'UGX',
          maximumFractionDigits: 0,
        }
      ).format(
        Number(value || 0)
      );
    }, []);

  const formatDate =
    useCallback((date) => {
      if (!date) {
        return 'N/A';
      }

      try {
        return new Date(
          date
        ).toLocaleDateString();
      } catch {
        return 'N/A';
      }
    }, []);

  const formatMembers =
    useCallback((members) => {
      if (
        !Array.isArray(members)
      ) {
        return '0 members';
      }

      return `${members.length} member${
        members.length === 1
          ? ''
          : 's'
      }`;
    }, []);

  // ==========================================================================
  // FETCH GROUPS
  // ==========================================================================

  const fetchGroups =
    useCallback(async () => {
      try {
        const response =
          await api.get(
            '/api/groups'
          );

        const data =
          response?.data ||
          response ||
          [];

        setGroups(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.response?.data
            ?.message ||
            'Failed to load groups'
        );
      }
    }, []);

  // ==========================================================================
  // FETCH ADMIN STATS
  // ==========================================================================

  const fetchAdminStats =
    useCallback(async () => {
      if (!isAdmin) return;

      try {
        const response =
          await api.get(
            '/api/admin/stats'
          );

        setStats(
          response?.data ||
            response
        );
      } catch (err) {
        console.error(
          'Admin stats error',
          err
        );
      }
    }, [isAdmin]);

  // ==========================================================================
  // INIT
  // ==========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    const load =
      async () => {
        try {
          await Promise.all([
            fetchGroups(),
            fetchAdminStats(),
          ]);
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
          }
        }
      };

    load();

    return () => {
      mountedRef.current =
        false;
    };
  }, [
    fetchGroups,
    fetchAdminStats,
  ]);

  // ==========================================================================
  // SOCKET NOTIFICATIONS
  // ==========================================================================

  useEffect(() => {
    let cleanup;

    import(
      '../services/socket'
    ).then(
      ({
        default: socket,
      }) => {
        const handler =
          () =>
            setNotifCount(
              (
                previous
              ) =>
                previous + 1
            );

        socket.on(
          'notification',
          handler
        );

        cleanup = () =>
          socket.off(
            'notification',
            handler
          );
      }
    );

    return () => {
      if (cleanup)
        cleanup();
    };
  }, []);

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const handleLogout =
    useCallback(
      async () => {
        try {
          await logout();

          navigate(
            '/login',
            {
              replace:
                true,
            }
          );
        } catch {
          toast.error(
            'Logout failed'
          );
        }
      },
      [
        logout,
        navigate,
      ]
    );

  // ==========================================================================
  // RETRY
  // ==========================================================================

  const handleRetry =
    useCallback(async () => {
      if (
        retryCount >= 3
      ) {
        toast.error(
          'Maximum retries reached'
        );
        return;
      }

      setRetryCount(
        (
          previous
        ) =>
          previous + 1
      );

      setError('');

      await fetchGroups();
    }, [
      retryCount,
      fetchGroups,
    ]);

  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    );
  }

  // ==========================================================================
  // AUTH CHECK
  // ==========================================================================

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
              '/login'
            )
          }
        >
          Login
        </button>
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="dashboard-container">

      <header className="dashboard-header">
        <h1>
          Welcome,
          {' '}
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

        <div className="stat-card">
          <PiggyBank />
          <h3>
            Savings
          </h3>
          <p>
            {formatCurrency(
              stats.savings
            )}
          </p>
        </div>

        <div className="stat-card">
          <Wallet />
          <h3>
            Groups
          </h3>
          <p>
            {
              groups.length
            }
          </p>
        </div>

        <div className="stat-card">
          <CreditCard />
          <h3>
            Members
          </h3>
          <p>
            {stats.members ||
              0}
          </p>
        </div>

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
          TITech Community Groups
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
                  {group.description}
                </p>

                <p>
                  {formatMembers(
                    group.members
                  )}
                </p>

                <p>
                  {formatCurrency(
                    group.totalContributions
                  )}
                </p>

                <p>
                  Next:
                  {' '}
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