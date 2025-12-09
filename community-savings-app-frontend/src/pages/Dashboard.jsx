// src/pages/Dashboard.jsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Menu, X } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * Fetch groups associated with the logged-in user
   */
  const fetchUserGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/groups/my-groups', {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setGroups(res.data);
    } catch (err) {
      console.error('Group fetch error:', err);
      setError('Failed to load groups.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Redirects to login if not authenticated; otherwise fetch user groups
   */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      fetchUserGroups();
    }
  }, [navigate]);

  /**
   * Logs out user and navigates to login
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
          {loading && <p className="text-blue-500">Loading groups...</p>}
          {error && <p className="text-red-500">{error}</p>}

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
                    <h4 className="font-bold text-blue-800">{group.name}</h4>
                    <p className="text-sm text-gray-600">
                      Contributions: UGX {group.totalContributions}
                    </p>
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
