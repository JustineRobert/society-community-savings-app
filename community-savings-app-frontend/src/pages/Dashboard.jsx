// src/pages/Dashboard.jsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Menu, X } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true); // overall loading for page
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const didFetchRef = useRef({ me: false, groups: false });

  /**
   * Fetch groups associated with the logged-in user
   */
  const fetchUser = useCallback(async () => {
    if (didFetchRef.current.me) return null;
    didFetchRef.current.me = true;
    try {
      const me = await api.get('/api/auth/me');
      return me || null;
    } catch (err) {
      console.error('Fetch /api/auth/me error:', err);
      if (err?.status === 401) {
        try { await logout(); } catch {}
      }
      return null;
    }
  }, [logout]);

  const fetchUserGroups = useCallback(async () => {
    if (didFetchRef.current.groups) return;
    didFetchRef.current.groups = true;
    setLoadingGroups(true);
    try {
      const res = await api.get('/api/groups');
      setGroups(res?.data || res?.data?.data || []);
    } catch (err) {
      console.error('Group fetch error:', err);
      if (err?.status === 401) {
        try { await logout(); } catch {}
        navigate('/login');
        return;
      }
      setError('Failed to load groups.');
    } finally {
      setLoadingGroups(false);
      setLoading(false);
    }
  }, [logout, navigate]);

  /**
   * Redirects to login if not authenticated; otherwise fetch user groups
   */
  // Fetch auth info and groups once (avoid React Strict double-fetch)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        await fetchUser();

        if (mounted) await fetchUserGroups();
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Initialization failed.');
      }
    };

    init();

    return () => { mounted = false; };
  }, [fetchUser, fetchUserGroups, navigate]);

  /**
   * Logs out user and navigates to login
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRetry = async () => {
    didFetchRef.current.groups = false;
    setError('');
    setLoading(true);
    await fetchUserGroups();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile top navbar */}
      <div className="bg-white shadow-md p-4 flex justify-between items-center md:hidden">
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-700">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="md:flex">
        {/* Sidebar navigation */}
        <aside
          className={`${
            menuOpen ? 'block' : 'hidden'
          } md:block bg-white md:w-64 p-4 shadow-md`}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{user?.name}</h2>
            <p className="text-sm text-gray-500">Role: {user?.role}</p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 text-white w-full py-2 rounded-xl hover:bg-red-600"
          >
            Logout
          </button>

          {/* Admin controls */}
          {user?.role === 'admin' && (
            <div className="mt-8 space-y-3">
              <button
                onClick={() => navigate('/create-group')}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Create Group
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Manage Users
              </button>
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main className="flex-1 p-6">
          {(loading || loadingGroups) && <p className="text-blue-500">Loading groups...</p>}
          {error && (
            <div>
              <p className="text-red-500">{error}</p>
              <button onClick={handleRetry} className="mt-2 px-3 py-1 bg-yellow-400 rounded">Retry</button>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Your Groups
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => (
                  <li
                    key={group._id}
                    className="bg-white p-4 rounded-xl shadow hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-blue-800">{group.name}</h4>
                        <p className="text-sm text-gray-600">{group.description}</p>
                        <div className="mt-2 text-sm text-gray-700">
                          <strong>Members:</strong>{' '}
                          {Array.isArray(group.members) ? (
                            <>
                              {group.members.slice(0,3).map((m, idx) => (
                                <span key={idx}>{m.name || m.email || (m._id || m)}</span>
                              )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                              {group.members.length > 3 && ` and ${group.members.length - 3} more`}
                            </>
                          ) : (
                            <span>{group.members?.length ?? 0} members</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-sm text-gray-600">
                        <div>
                          <strong>Total:</strong> UGX {group.totalContributions ?? 0}
                        </div>
                        <div className="mt-1">
                          <strong>Next:</strong>{' '}
                          {group.nextContributionDate ? new Date(group.nextContributionDate).toLocaleDateString() : 'Not scheduled'}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && groups.length === 0 && (
            <p className="text-gray-600">You have not joined any groups yet.</p>
          )}
        </main>
      </div>
    </div>
  );
};       



export default Dashboard;
