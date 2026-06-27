import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Users,
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Building2,
  UserCheck,
  TrendingUp,
} from 'lucide-react';

import { toast } from 'react-toastify';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

import './AdminDashboard.css';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = 'primary',
}) => (
  <div className={`admin-stat-card ${color}`}>
    <div className="admin-stat-icon">
      <Icon size={24} />
    </div>

    <div className="admin-stat-content">
      <p>{title}</p>
      <h3>{value}</h3>
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="admin-loading">
    {[...Array(4)].map((_, index) => (
      <div
        key={index}
        className="admin-skeleton-card"
      />
    ))}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [groupRequests, setGroupRequests] = useState([]);

  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingGroups: 0,
    approvedGroups: 0,
  });

  const [error, setError] = useState('');

  const isAdmin = useMemo(() => {
    return ['admin', 'super_admin'].includes(
      String(user?.role || '').toLowerCase()
    );
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [
        usersResponse,
        requestsResponse,
      ] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/group-requests'),
      ]);

      if (!mountedRef.current) return;

      const usersData =
        usersResponse?.data?.data ||
        usersResponse?.data ||
        [];

      const requestsData =
        requestsResponse?.data?.data ||
        requestsResponse?.data ||
        [];

      setUsers(usersData);
      setGroupRequests(requestsData);

      setMetrics({
        totalUsers: usersData.length,

        activeUsers: usersData.filter(
          (u) => u.status === 'active'
        ).length,

        pendingGroups: requestsData.filter(
          (g) =>
            g.status === 'pending' ||
            !g.status
        ).length,

        approvedGroups: requestsData.filter(
          (g) => g.status === 'approved'
        ).length,
      });
    } catch (err) {
      console.error(err);

      if (
        err?.response?.status === 401
      ) {
        try {
          await logout();
        } catch {}

        navigate('/login', {
          replace: true,
        });

        return;
      }

      const message =
        err?.response?.data?.message ||
        'Failed to load dashboard data';

      setError(message);

      toast.error(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [logout, navigate]);

  const approveGroup = useCallback(
    async (groupId) => {
      try {
        await api.post(
          `/api/admin/group-requests/${groupId}/approve`
        );

        toast.success(
          'Group approved successfully'
        );

        fetchDashboardData();
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          'Approval failed';

        toast.error(message);
      }
    },
    [fetchDashboardData]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      navigate('/login');
      return;
    }

    if (!isAdmin) {
      toast.error(
        'Administrator access required'
      );

      navigate('/dashboard', {
        replace: true,
      });

      return;
    }

    fetchDashboardData();

    return () => {
      mountedRef.current = false;
    };
  }, [
    user,
    isAdmin,
    navigate,
    fetchDashboardData,
  ]);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* HEADER */}

      <div className="admin-header">
        <div>
          <h1>
            TITech Administration Center
          </h1>

          <p>
            System operations,
            governance and platform
            monitoring
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={fetchDashboardData}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="admin-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* KPIs */}

      <div className="admin-stats-grid">
        <StatCard
          title="Total Users"
          value={metrics.totalUsers}
          icon={Users}
        />

        <StatCard
          title="Active Users"
          value={metrics.activeUsers}
          icon={UserCheck}
          color="success"
        />

        <StatCard
          title="Pending Groups"
          value={metrics.pendingGroups}
          icon={Clock}
          color="warning"
        />

        <StatCard
          title="Approved Groups"
          value={metrics.approvedGroups}
          icon={CheckCircle}
          color="success"
        />
      </div>

      {/* ADMIN MODULES */}

      <div className="admin-modules-grid">
        <div className="module-card">
          <Shield size={24} />
          <h3>KYC & AML</h3>
          <p>
            Customer verification,
            sanctions screening and
            compliance monitoring.
          </p>
        </div>

        <div className="module-card">
          <TrendingUp size={24} />
          <h3>Risk Engine</h3>
          <p>
            Fraud detection and
            behavioral risk scoring.
          </p>
        </div>

        <div className="module-card">
          <Building2 size={24} />
          <h3>Community Groups</h3>
          <p>
            Savings groups,
            contributions and
            approvals.
          </p>
        </div>

        <div className="module-card">
          <Activity size={24} />
          <h3>Audit Monitoring</h3>
          <p>
            Real-time audit events and
            compliance logs.
          </p>
        </div>
      </div>

      {/* USERS */}

      <section className="admin-section">
        <h2>Platform Users</h2>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        u.status || 'active'
                      }`}
                    >
                      {u.status || 'active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GROUP REQUESTS */}

      <section className="admin-section">
        <h2>
          Pending Group Approvals
        </h2>

        {groupRequests.length === 0 ? (
          <div className="empty-admin-state">
            No pending requests
          </div>
        ) : (
          <div className="request-list">
            {groupRequests.map((req) => (
              <div
                key={req._id}
                className="request-card"
              >
                <div>
                  <h4>
                    {req.name}
                  </h4>

                  <p>
                    Owner:{' '}
                    {req.owner?.name ||
                      'Unknown'}
                  </p>
                </div>

                <button
                  onClick={() =>
                    approveGroup(req._id)
                  }
                  className="approve-btn"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;