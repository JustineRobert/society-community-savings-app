// ============================================================================
// frontend/src/pages/admin/AdminSessions.jsx
// TITech Community Capital
// Enterprise Session Administration Console
// Production Grade
// ============================================================================

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';

import api from '../../services/api';
import { toast } from 'react-toastify';

import {
  RefreshCw,
  Shield,
  Monitor,
  Smartphone,
  Globe,
  Search,
  Ban,
  AlertTriangle,
} from 'lucide-react';

const AdminSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [showRevoked, setShowRevoked] = useState(true);

  // ===========================================================================
  // FETCH SESSIONS
  // ===========================================================================

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get('/api/auth/admin/sessions');

      const payload =
        response?.data?.data ||
        response?.data?.sessions ||
        response?.data ||
        [];

      setSessions(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
          'Failed to load sessions'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setRefreshing(true);

      const response = await api.get('/api/auth/admin/sessions');

      const payload =
        response?.data?.data ||
        response?.data?.sessions ||
        response?.data ||
        [];

      setSessions(Array.isArray(payload) ? payload : []);

      toast.success('Sessions refreshed');
    } catch (error) {
      console.error(error);

      toast.error('Failed to refresh sessions');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ===========================================================================
  // FILTERS
  // ===========================================================================

  const processedSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (!showRevoked && session.revokedAt) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query = search.toLowerCase();

      return (
        String(session.id || '')
          .toLowerCase()
          .includes(query) ||
        String(session.userId || '')
          .toLowerCase()
          .includes(query) ||
        String(session.deviceInfo?.ip || '')
          .toLowerCase()
          .includes(query) ||
        String(session.deviceInfo?.ua || '')
          .toLowerCase()
          .includes(query)
      );
    });
  }, [sessions, search, showRevoked]);

  useEffect(() => {
    setFilteredSessions(processedSessions);
  }, [processedSessions]);

  // ===========================================================================
  // REVOKE SESSION
  // ===========================================================================

  const revokeSession = useCallback(async (sessionId) => {
    const confirmed = window.confirm(
      'Are you sure you want to revoke this session?'
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/api/auth/admin/sessions/${sessionId}`
      );

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                revokedAt:
                  session.revokedAt ||
                  new Date().toISOString(),
              }
            : session
        )
      );

      toast.success('Session revoked');
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
          'Unable to revoke session'
      );
    }
  }, []);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const formatDate = (value) => {
    if (!value) return '-';

    try {
      return new Date(value).toLocaleString();
    } catch {
      return '-';
    }
  };

  const getDeviceIcon = (ua = '') => {
    const agent = ua.toLowerCase();

    if (
      agent.includes('mobile') ||
      agent.includes('android') ||
      agent.includes('iphone')
    ) {
      return <Smartphone size={16} />;
    }

    return <Monitor size={16} />;
  };

  const activeCount = sessions.filter(
    (s) => !s.revokedAt
  ).length;

  const revokedCount = sessions.filter(
    (s) => s.revokedAt
  ).length;

  // ===========================================================================
  // LOADING
  // ===========================================================================

  if (loading) {
    return (
      <div className="admin-sessions-page">
        <div className="loading-container">
          <RefreshCw
            size={40}
            className="animate-spin"
          />
          <h3>Loading Sessions...</h3>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="admin-sessions-page">
      <div className="page-header">
        <div>
          <h1>
            <Shield size={28} />
            Session Administration
          </h1>

          <p>
            Manage active authentication sessions
            across the platform.
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={refreshSessions}
          disabled={refreshing}
        >
          <RefreshCw
            size={18}
            className={
              refreshing ? 'animate-spin' : ''
            }
          />
          Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Sessions</h3>
          <span>{sessions.length}</span>
        </div>

        <div className="stat-card active">
          <h3>Active</h3>
          <span>{activeCount}</span>
        </div>

        <div className="stat-card revoked">
          <h3>Revoked</h3>
          <span>{revokedCount}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={() =>
              setShowRevoked((v) => !v)
            }
          />
          Show Revoked Sessions
        </label>
      </div>

      <div className="sessions-table-wrapper">
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>User</th>
              <th>Device</th>
              <th>IP Address</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredSessions.length === 0 && (
              <tr>
                <td colSpan="8">
                  No sessions found
                </td>
              </tr>
            )}

            {filteredSessions.map((session) => (
              <tr key={session.id}>
                <td>
                  <code>{session.id}</code>
                </td>

                <td>{session.userId}</td>

                <td>
                  <div className="device-cell">
                    {getDeviceIcon(
                      session.deviceInfo?.ua
                    )}

                    <span>
                      {session.deviceInfo?.ua ||
                        'Unknown Device'}
                    </span>
                  </div>
                </td>

                <td>
                  <div className="device-cell">
                    <Globe size={16} />
                    {session.deviceInfo?.ip || '-'}
                  </div>
                </td>

                <td>
                  {formatDate(session.createdAt)}
                </td>

                <td>
                  {formatDate(session.expiresAt)}
                </td>

                <td>
                  {session.revokedAt ? (
                    <span className="status revoked">
                      <AlertTriangle size={14} />
                      Revoked
                    </span>
                  ) : (
                    <span className="status active">
                      Active
                    </span>
                  )}
                </td>

                <td>
                  {!session.revokedAt && (
                    <button
                      className="revoke-btn"
                      onClick={() =>
                        revokeSession(session.id)
                      }
                    >
                      <Ban size={16} />
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSessions;