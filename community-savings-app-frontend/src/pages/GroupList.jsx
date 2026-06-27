// ============================================================================
// TITech Community Capital – Group List Page
// File: frontend/src/pages/GroupList.jsx
// Production-grade
// ============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import logger from '../../utils/logger';

export default function GroupList() {
  const [groups, setGroups] = useState([]);
  const [joining, setJoining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {}
    }
    abortRef.current = new AbortController();

    try {
      const api = (await import('../services/api')).default;
      const res = await api.get('/api/groups', { signal: abortRef.current.signal });
      const data = res?.data?.data || res?.data || [];
      if (mountedRef.current) setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.message || err?.message || 'Failed to load groups';
      setError(msg);
      toast.error(msg);
      logger?.warn?.('GroupList fetch failed', { error: msg });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchGroups();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, [fetchGroups]);

  const joinGroup = useCallback(
    async (groupId) => {
      setJoining(groupId);
      const prevGroups = groups;

      // optimistic update
      const optimistic = groups.map((g) => {
        if (g._id !== groupId) return g;
        const members = Array.isArray(g.members) ? [...g.members] : [];
        const userId = user?._id || user?.id || user?.userId;
        if (userId && !members.find((m) => (m._id || m) === userId)) {
          members.push({ _id: userId, name: user?.name || user?.email || 'You' });
        }
        return { ...g, members: members.slice(-500), __joinedOptimistic: true }; // bound list
      });
      setGroups(optimistic);

      try {
        const api = (await import('../services/api')).default;
        await api.post(`/api/groups/join/${groupId}`);
        toast.success('Successfully joined the group!');
        const fresh = await api.get('/api/groups');
        setGroups(fresh?.data?.data || fresh?.data || []);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to join group';
        toast.error(msg);
        logger?.error?.('Join group failed', { groupId, error: msg });
        setGroups(prevGroups); // rollback
      } finally {
        if (mountedRef.current) setJoining(null);
      }
    },
    [groups, user]
  );

  return (
    <section className="group-list-container p-6" aria-labelledby="group-list-heading">
      <h2 id="group-list-heading" className="text-2xl font-bold mb-4">
        Available Groups
      </h2>

      {loading && (
        <div className="p-3 text-center">
          <Spinner label="Loading groups…" />
        </div>
      )}

      {error && (
        <div role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && groups.length === 0 ? (
        <p className="text-gray-600">No groups available. Check back later!</p>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li
              key={group._id}
              className="group-item p-4 border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition duration-200"
            >
              <h4 className="text-xl font-semibold">{group.name || 'Unnamed Group'}</h4>
              <p className="text-gray-700 mb-2">{group.description || 'No description provided.'}</p>
              <p className="text-sm text-gray-500 mb-2">
                Members: {Array.isArray(group.members) ? group.members.length : 0}
              </p>
              <button
                type="button"
                onClick={() => joinGroup(group._id)}
                disabled={joining === group._id}
                className={`w-full py-2 mt-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition duration-200 ${
                  joining === group._id ? 'cursor-wait' : ''
                }`}
                aria-busy={joining === group._id}
              >
                {joining === group._id ? 'Joining…' : 'Join Group'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}