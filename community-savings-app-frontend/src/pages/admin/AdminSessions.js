import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const AdminSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/auth/admin/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('Revoke this session?')) return;
    try {
      await api.delete(`/api/auth/admin/sessions/${id}`);
      toast.success('Session revoked');
      setSessions((s) => s.filter((x) => x.id !== id));
    } catch (err) {
      console.error('Failed to revoke session', err);
      toast.error('Failed to revoke session');
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin — Sessions</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>ID</th>
                <th style={{ textAlign: 'left', padding: 8 }}>User</th>
                <th style={{ textAlign: 'left', padding: 8 }}>IP</th>
                <th style={{ textAlign: 'left', padding: 8 }}>UA</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Created</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Expires</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Revoked</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 10 }}>
                    No sessions found
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{s.id}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{s.userId}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{s.deviceInfo?.ip}</td>
                  <td style={{ padding: 8, verticalAlign: 'top', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.deviceInfo?.ua}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{new Date(s.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{new Date(s.expiresAt).toLocaleString()}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>{s.revokedAt ? new Date(s.revokedAt).toLocaleString() : '-'}</td>
                  <td style={{ padding: 8, verticalAlign: 'top' }}>
                    {!s.revokedAt && (
                      <button onClick={() => revoke(s.id)} style={{ padding: '6px 8px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSessions;
