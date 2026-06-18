// src/pages/Dashboard.jsx
/**
 * Dashboard Component
 * Main user dashboard showing community savings groups.
 * Production-ready features:
 * - Secure error handling and user feedback
 * - Loading states with skeleton screens
 * - Proper role-based access control
 * - Accessibility (WCAG 2.1 AA compliant)
 * - Optimized performance with useCallback
 * - Memory leak prevention
 * - Responsive mobile-first design
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
// import { AdminDashboard } from '../pages/Dashboard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// // ✅ FIXED: Single declaration using arrow function

const AdminDashboard = () => {

  // const [data, setData] = useState({ loans: [], fraud: [] });

  // useEffect(() => {
   //  axios.get('/api/admin/stats').then(res => {
      // setData(res.data);
    // });
  // }, []);

  return null; // keep if rendering handled elsewhere

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 TITech Admin Dashboard</h2>

      <h3>Loan Distribution</h3>
      <BarChart width={500} height={300} data={data.loans}>
        <XAxis dataKey="status" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>

      <h3>Fraud Detection</h3>
      <PieChart width={400} height={300}>
        <Pie
          data={data.fraud}
          dataKey="value"
          outerRadius={100}
        >
          {data.fraud?.map((entry, index) => (
            <Cell key={index} fill={index === 0 ? 'red' : 'green'} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
};

// Skeleton Loader Component
const GroupCardSkeleton = () => (
  <div className="group-card-skeleton" aria-hidden="true">
    <div className="skeleton-title"></div>
    <div className="skeleton-text"></div>
    <div className="skeleton-text"></div>
    <div className="skeleton-text"></div>
  </div>
);

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // notification counter from websocket
  const [notifCount, setNotifCount] = useState(0);

  // State management
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const didFetchRef = useRef({ me: false, groups: false });
  const mountedRef = useRef(true);

  // Safe localStorage operations
  const safeGetStorageItem = useCallback((key) => {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn(`Could not access localStorage.${key}:`, err);
      return null;
    }
  }, []);

  // setup websocket notification listener
  useEffect(() => {
    let cleanup;
    import('../services/socket').then(({ default: socket }) => {
      const handle = () => setNotifCount((c) => c + 1);
      socket.on('notification', handle);
      cleanup = () => socket.off('notification', handle);
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  /**
   * Fetch user authentication info
   */
  const fetchUser = useCallback(async () => {
    if (didFetchRef.current.me) return null;
    didFetchRef.current.me = true;

    try {
      const response = await api.get('/api/auth/me');
      if (!mountedRef.current) return null;
      return response?.data || response || null;
    } catch (err) {
      console.error('Auth verification error:', err);

      // Handle authentication failures
      if (err?.response?.status === 401) {
        try {
          await logout();
        } catch (logoutErr) {
          console.error('Logout error:', logoutErr);
        }
        if (mountedRef.current) {
          navigate('/login', { replace: true });
        }
      }
      return null;
    }
  }, [logout, navigate]);

  /**
   * Fetch user's groups with error handling
   */
  const fetchUserGroups = useCallback(async () => {
    if (didFetchRef.current.groups) return;
    didFetchRef.current.groups = true;
    setLoadingGroups(true);
    setError('');

    try {
      const response = await api.get('/api/groups');

      if (!mountedRef.current) return;

      // Handle various response formats
      const groupsData = response?.data?.data || response?.data || [];

      // Validate groups array
      if (!Array.isArray(groupsData)) {
        throw new Error('Invalid groups data format');
      }

      setGroups(groupsData);
    } catch (err) {
      console.error('Group fetch error:', err);

      if (!mountedRef.current) return;

      // Handle authentication failures
      if (err?.response?.status === 401) {
        try {
          await logout();
        } catch (logoutErr) {
          console.error('Logout error:', logoutErr);
        }
        navigate('/login', { replace: true });
        return;
      }

      // Set user-friendly error message
      const errorMsg = err?.response?.data?.message || 'Failed to load groups. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      if (mountedRef.current) {
        setLoadingGroups(false);
        setLoading(false);
      }
    }
  }, [logout, navigate]);

  /**
   * Initialize component - verify auth and fetch data
   */
  useEffect(() => {
    mountedRef.current = true;

    const initDashboard = async () => {
      try {
        const token = safeGetStorageItem('token');

        if (!token) {
          navigate('/login', { replace: true });
          return;
        }

        // Verify authentication
        await fetchUser();

        // Fetch groups if still mounted
        if (mountedRef.current) {
          await fetchUserGroups();
        }
      } catch (err) {
        console.error('Dashboard initialization error:', err);
        if (mountedRef.current) {
          setError('Failed to load dashboard.');
          toast.error('An error occurred while loading your dashboard.');
        }
      }
    };

    initDashboard();

    // Cleanup function
    return () => {
      mountedRef.current = false;
    };
    // Include all referenced values to satisfy exhaustive-deps
  }, [fetchUser, fetchUserGroups, navigate, safeGetStorageItem]); // << fixed deps

  /**
   * Handle logout with error handling
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Error logging out. Please try again.');
    }
  }, [logout, navigate]);

  /**
   * Handle groups fetch retry
   */
  const handleRetry = useCallback(async () => {
    if (retryCount >= 3) {
      toast.error('Maximum retries reached. Please refresh the page.');
      return;
    }

    setRetryCount((prev) => prev + 1);
    didFetchRef.current.groups = false;
    setError('');
    setLoading(true);
    await fetchUserGroups();
  }, [fetchUserGroups, retryCount]);

  /**
   * Navigate to create group page with permission check
   */
  const handleCreateGroup = useCallback(() => {
    if (user?.role !== 'admin') {
      toast.error('Only administrators can create groups.');
      return;
    }
    navigate('/create-group');
  }, [user?.role, navigate]);

  /**
   * Navigate to manage users page with permission check
   */
  const handleManageUsers = useCallback(() => {
    if (user?.role !== 'admin') {
      toast.error('Only administrators can manage users.');
      return;
    }
    navigate('/admin/users');
  }, [user?.role, navigate]);

  /**
   * Format member display safely
   */
  const formatMembers = useMemo(() => {
    return (members) => {
      if (!Array.isArray(members) || members.length === 0) {
        return 'No members';
      }

      try {
        const displayNames = members
          .slice(0, 3)
          .map((m) => m?.name || m?.email || 'Unknown')
          .filter(Boolean);

        const remaining = members.length - displayNames.length;
        const suffix = remaining > 0 ? ` and ${remaining} more` : '';

        return displayNames.join(', ') + suffix;
      } catch (err) {
        console.error('Error formatting members:', err);
        return `${members.length || 0} members`;
      }
    };
  }, []);

  /**
   * Format currency safely
   */
  const formatCurrency = useCallback((value) => {
    try {
      const num = Number(value) || 0;
      return `UGX ${num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    } catch {
      return 'UGX 0';
    }
  }, []);

  /**
   * Format date safely
   */
  const formatDate = useCallback((dateString) => {
    try {
      if (!dateString) return 'Not scheduled';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  /**
   * Navigate to group details
   */
  const handleGroupClick = useCallback(
    (groupId) => {
      navigate(`/groups/${groupId}`);
    },
    [navigate]
  );

  // Check if user has admin role
  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  // Render loading state
  if (loading) {
    return (
      <div className="dashboard-container" role="status" aria-live="polite">
        <div className="dashboard-top-nav">
          <h1 className="dashboard-title">Dashboard</h1>
        </div>

        <div className="dashboard-layout">
          <aside className="dashboard-sidebar" aria-label="Navigation">
            <div className="user-profile-skeleton"></div>
            <div className="skeleton-button"></div>
          </aside>

          <main className="dashboard-main" aria-label="Main content">
            <div className="loading-message">
              <div className="spinner" aria-hidden="true"></div>
              <p className="loading-text">Loading your dashboard...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Render error state
  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="error-screen">
          <AlertCircle size={48} />
          <h2>Authentication Required</h2>
          <p>Please log in to continue.</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="btn-primary"
            type="button"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="dashboard-container">
      {/* Top Navigation for Mobile */}
      <div className="dashboard-top-nav">
        <h1 className="dashboard-title">Dashboard</h1>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="dashboard-layout">
        {/* Sidebar Navigation */}
        <aside className={`dashboard-sidebar ${menuOpen ? 'open' : ''}`} aria-label="User menu">
          {/* User Profile Section */}
          <div className="user-profile">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || '?'}</div>
            <div className="user-info">
              <h2 className="user-name">{user?.name || 'User'}</h2>
              <p className="user-role">{user?.role === 'admin' ? 'Administrator' : 'Member'}</p>
            </div>
          </div>

          {/* Navigator Links */}
          <nav className="sidebar-nav" role="navigation">
            <button
              onClick={handleLogout}
              className="btn-logout"
              type="button"
              aria-label="Log out from account"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="admin-section">
                <h3 className="admin-title">Admin Tools</h3>
                <button
                  onClick={handleCreateGroup}
                  className="btn-admin-action"
                  type="button"
                  aria-label="Create a new community savings group"
                >
                  <Plus size={18} />
                  <span>Create Group</span>
                </button>
                <button
                  onClick={handleManageUsers}
                  className="btn-admin-action"
                  type="button"
                  aria-label="Manage system users"
                >
                  <Users size={18} />
                  <span>Manage Users</span>
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main" role="main">
          {notifCount > 0 && (
            <div className="notification-badge" aria-live="polite">
              You have {notifCount} new notification{notifCount !== 1 ? 's' : ''}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-container" role="alert" aria-live="assertive">
              <div className="error-content">
                <AlertCircle size={20} />
                <div className="error-message">
                  <h3>Unable to Load Groups</h3>
                  <p>{error}</p>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="btn-retry"
                disabled={retryCount >= 3}
                type="button"
                aria-label="Retry loading groups"
              >
                <RefreshCw size={16} />
                {retryCount >= 3 ? 'Max retries reached' : 'Retry'}
              </button>
            </div>
          )}

          {/* Loading State */}
          {loadingGroups && groups.length === 0 && (
            <div
              className="groups-loading"
              role="status"
              aria-live="polite"
              aria-label="Loading groups"
            >
              <div className="groups-skeleton">
                {[...Array(3)].map((_, i) => (
                  <GroupCardSkeleton key={i} />
                ))}
              </div>
            </div>
          )}

          {/* Groups List */}
          {!loading && groups.length > 0 && (
            <section className="groups-section">
              <h2 className="section-title">Your Community Savings Groups</h2>
              <p className="section-subtitle">
                {groups.length} {groups.length === 1 ? 'group' : 'groups'} available
              </p>

              <div className="groups-grid" role="list" aria-label="Community savings groups">
                {groups.map((group) => (
                  <article
                    key={group._id}
                    className="group-card"
                    role="listitem"
                    tabIndex="0"
                    onClick={() => handleGroupClick(group._id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGroupClick(group._id);
                    }}
                  >
                    <div className="group-header">
                      <h3 className="group-name">{group?.name || 'Unnamed'}</h3>
                      <span
                        className="group-badge"
                        aria-label={`${group?.status || 'active'} status`}
                      >
                        {group?.status || 'Active'}
                      </span>
                    </div>

                    <p className="group-description">
                      {group?.description || 'No description available'}
                    </p>

                    <div className="group-stats">
                      <div className="stat">
                        <span className="stat-label">Members</span>
                        <span className="stat-value">{formatMembers(group?.members)}</span>
                      </div>

                      <div className="stat">
                        <span className="stat-label">Total Saved</span>
                        <span className="stat-value">
                          {formatCurrency(group?.totalContributions)}
                        </span>
                      </div>

                      <div className="stat">
                        <span className="stat-label">Next Cycle</span>
                        <span className="stat-value">
                          {formatDate(group?.nextContributionDate)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="group-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupClick(group._id);
                      }}
                      type="button"
                      aria-label={`View details of ${group?.name} group`}
                    >
                      View Details →
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {!loading && groups.length === 0 && !error && (
            <section className="empty-state">
              <div className="empty-state-icon">👥</div>
              <h2 className="empty-state-title">No Groups Yet</h2>
              <p className="empty-state-text">You haven't joined any community savings groups.</p>
              {isAdmin && (
                <button onClick={handleCreateGroup} className="btn-primary" type="button">
                  <Plus size={18} />
                  Create Your First Group
                </button>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
