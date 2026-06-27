// ============================================================================
// TITech Community Capital – Admin Manage Users Page
// File: frontend/src/pages/admin/ManageUsers.jsx
// Production-grade
// ============================================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuthorization } from '../../components/AdminRoute';
import Modal from '../../components/common/Modal';

/**
 * ManageUsers
 *
 * - Server-backed list with pagination, sorting and search
 * - Edit modal with safe controlled inputs
 * - Defensive checks, error handling and optimistic UI updates
 */
export default function ManageUsers({ initialUsers = [], apiBase = '/api/admin' }) {
  const { authorized, loading } = useAuthorization({ roles: ['admin'] });

  // Data
  const [users, setUsers] = useState(initialUsers);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState(null);

  // Search / sort / pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal / edit
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Helper to normalize id field
  const getId = (u) => (u && (u.id || u._id || u._id?.toString ? u._id : u.id));

  // Debounce search input to avoid spamming API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch users from server with pagination, sorting and search
  const fetchUsers = useCallback(async () => {
    if (!authorized) return;
    setLoadingUsers(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
        search: debouncedSearch || '',
      });
      const res = await fetch(`${apiBase}/users?${q.toString()}`, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch users: ${res.status} ${text}`);
      }
      const data = await res.json();
      setUsers(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  }, [authorized, page, pageSize, sortBy, sortOrder, debouncedSearch, apiBase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Open edit modal (clone user to avoid mutating list directly)
  const handleEdit = (user) => {
    setSelectedUser({ ...user });
    setModalOpen(true);
  };

  // Delete user (optimistic UI)
  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${apiBase}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete failed: ${res.status} ${text}`);
      }
      setUsers((prev) => prev.filter((u) => String(getId(u)) !== String(userId)));
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user. See console for details.');
    }
  };

  // Save edited user (optimistic update with server confirmation)
  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const id = getId(selectedUser);
      const res = await fetch(`${apiBase}/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(selectedUser),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Update failed: ${res.status} ${text}`);
      }
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (String(getId(u)) === String(getId(updated)) ? updated : u)));
      setModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Failed to update user', err);
      alert('Failed to update user. See console for details.');
    } finally {
      setSaving(false);
    }
  };

  // Pagination clamping helpers
  const clampPage = (next) => {
    const p = Math.max(1, Math.min(totalPages, Number(next) || 1));
    setPage(p);
  };

  // Derived paged users for local-only fallback (if server doesn't paginate)
  const pagedUsers = useMemo(() => {
    // If server returns full list, we still support client-side paging as fallback
    if (!users || users.length === 0) return [];
    const start = (page - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, page, pageSize]);

  if (loading) return <p>Loading authorization...</p>;
  if (!authorized) return <p>Access denied.</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <div className="text-sm text-gray-600">Total: {users.length}</div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // reset to first page when searching
          }}
          className="border rounded px-3 py-2 w-full"
          aria-label="Search users"
        />
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="mb-4 text-red-600" role="alert">
          {error}
        </div>
      )}
      {loadingUsers && (
        <div className="mb-4 text-gray-600">Loading users…</div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              {['name', 'email', 'role', 'status'].map((field) => (
                <th
                  key={field}
                  className="border px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort(field)}
                  scope="col"
                >
                  <div className="flex items-center gap-2">
                    <span>{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                    {sortBy === field && <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
              ))}
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              pagedUsers.map((user) => {
                const id = getId(user);
                return (
                  <tr key={id} className="hover:bg-gray-50">
                    <td className="border px-3 py-2">{user.name}</td>
                    <td className="border px-3 py-2">{user.email}</td>
                    <td className="border px-3 py-2">{user.role}</td>
                    <td className="border px-3 py-2">{user.status}</td>
                    <td className="border px-3 py-2 space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-2 py-1 bg-blue-600 text-white rounded"
                        aria-label={`Edit ${user.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        className="px-2 py-1 bg-red-600 text-white rounded"
                        aria-label={`Delete ${user.name}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <button
          disabled={page === 1}
          onClick={() => clampPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => clampPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setSelectedUser(null); }} title="Edit User" size="md">
        {selectedUser ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="mb-3">
              <label className="block mb-1">Name</label>
              <input
                type="text"
                value={selectedUser.name ?? ''}
                onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                className="border rounded px-3 py-2 w-full"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block mb-1">Email</label>
              <input
                type="email"
                value={selectedUser.email ?? ''}
                onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                className="border rounded px-3 py-2 w-full"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block mb-1">Role</label>
              <select
                value={selectedUser.role ?? 'user'}
                onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="block mb-1">Status</label>
              <select
                value={selectedUser.status ?? 'active'}
                onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value })}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-3 py-1 border rounded"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-green-600 text-white px-3 py-1 rounded"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 text-center text-gray-600">Loading…</div>
        )}
      </Modal>
    </div>
  );
}

ManageUsers.propTypes = {
  initialUsers: PropTypes.array,
  apiBase: PropTypes.string,
};
