// ============================================================================
// src/pages/admin/AdminDashboard.jsx
// TITech Community Capital
// Enterprise Admin Dashboard
// Production Grade
// ============================================================================

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {
  Users,
  Shield,
  Wallet,
  Landmark,
  Activity,
  AlertTriangle,
  UserCheck,
  Clock,
  RefreshCw,
  Settings,
} from 'lucide-react';

import { toast } from 'react-toastify';

import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

import './AdminDashboard.css';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`admin-stat-card ${color}`}>
    <div className="stat-icon">
      <Icon size={24} />
    </div>

    <div className="stat-content">
      <span>{title}</span>
      <h3>{value}</h3>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    activeGroups: 0,
    pendingApprovals: 0,
    activeLoans: 0,
    totalSavings: 0,
  });

  const [recentEvents, setRecentEvents] =
    useState([]);

  const isAdmin = useMemo(() => {
    return [
      'admin',
      'super_admin',
    ].includes(
      String(user?.role || '')
        .toLowerCase()
    );
  }, [user]);

  const loadDashboard =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          statsResponse,
          activityResponse,
        ] = await Promise.all([
          api.get('/api/admin/stats'),
          api.get('/api/admin/activity'),
        ]);

        setStats(
          statsResponse.data?.data ||
            statsResponse.data ||
            {}
        );

        setRecentEvents(
          activityResponse.data?.data ||
            activityResponse.data ||
            []
        );
      } catch (err) {
        console.error(err);

        toast.error(
          'Failed to load dashboard'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isAdmin) {
      navigate('/dashboard');

      toast.error(
        'Administrator access required'
      );

      return;
    }

    loadDashboard();
  }, [
    user,
    isAdmin,
    navigate,
    loadDashboard,
  ]);

  if (loading) {
    return (
      <div className="admin-loading">
        Loading administration center...
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}

      <div className="admin-header">
        <div>
          <h1>
            TITech Administration Center
          </h1>

          <p>
            Platform governance,
            monitoring and controls
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="refresh-btn"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* KPI CARDS */}

      <div className="stats-grid">

        <StatCard
          title="Users"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
        />

        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          icon={UserCheck}
          color="green"
        />

        <StatCard
          title="Groups"
          value={stats.activeGroups}
          icon={Wallet}
          color="gold"
        />

        <StatCard
          title="Pending"
          value={stats.pendingApprovals}
          icon={Clock}
          color="orange"
        />

        <StatCard
          title="Loans"
          value={stats.activeLoans}
          icon={Landmark}
          color="purple"
        />

        <StatCard
          title="Savings"
          value={`UGX ${Number(
            stats.totalSavings || 0
          ).toLocaleString()}`}
          icon={Wallet}
          color="teal"
        />

      </div>

      {/* QUICK ACTIONS */}

      <div className="admin-actions">

        <Link
          to="/admin/users"
          className="action-card"
        >
          <Users size={22} />
          <span>Manage Users</span>
        </Link>

        <Link
          to="/admin/sessions"
          className="action-card"
        >
          <Shield size={22} />
          <span>Manage Sessions</span>
        </Link>

        <Link
          to="/admin/settings"
          className="action-card"
        >
          <Settings size={22} />
          <span>Settings</span>
        </Link>

        <Link
          to="/admin/groups"
          className="action-card"
        >
          <Wallet size={22} />
          <span>Groups</span>
        </Link>

        <Link
          to="/admin/loans"
          className="action-card"
        >
          <Landmark size={22} />
          <span>Loans</span>
        </Link>

        <Link
          to="/admin/compliance"
          className="action-card"
        >
          <Shield size={22} />
          <span>AML / KYC</span>
        </Link>

      </div>

      {/* RECENT ACTIVITY */}

      <div className="admin-panel">
        <h2>
          <Activity size={18} />
          Recent Activity
        </h2>

        {recentEvents.length === 0 ? (
          <div className="empty-state">
            No recent activity
          </div>
        ) : (
          <div className="activity-list">

            {recentEvents.map(
              (event) => (
                <div
                  key={event._id}
                  className="activity-item"
                >
                  <AlertTriangle
                    size={16}
                  />

                  <div>
                    <strong>
                      {event.action}
                    </strong>

                    <p>
                      {event.description}
                    </p>

                    <small>
                      {new Date(
                        event.createdAt
                      ).toLocaleString()}
                    </small>
                  </div>
                </div>
              )
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
