// ============================================================================
// TITech Community Capital – Group Details Page
// File: frontend/src/pages/GroupDetails.jsx
// Production-grade
// ============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Spinner from '../components/ui/Spinner';
import logger from '../../utils/logger';

export default function GroupDetails() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const fetchGroupData = useCallback(async () => {
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
      const response = await api.get(`/api/groups/${groupId}`, {
        signal: abortRef.current.signal,
      });
      const data = response?.data?.data || response?.data || null;
      if (mountedRef.current) setGroup(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.message || err?.message || 'Failed to load group';
      setError(msg);
      logger?.warn?.('GroupDetails fetch failed', { groupId, error: msg });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchGroupData();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, [fetchGroupData]);

  const handleContribute = useCallback(
    async (e) => {
      e.preventDefault();
      setContributing(true);
      setSuccessMessage('');
      setError(null);

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No token found. Please log in.');
          toast.error('Authentication required.');
          return;
        }

        const api = (await import('../services/api')).default;
        const response = await api.post(`/api/groups/${groupId}/contribute`, {
          amount: Number(contributionAmount),
        });

        const updatedGroup = response?.data?.data || response?.data || response;
        if (mountedRef.current) {
          setGroup(updatedGroup);
          setContributionAmount('');
          setSuccessMessage('Contribution successful!');
          toast.success('Contribution successful!');
        }
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Contribution failed';
        setError(msg);
        toast.error(msg);
        logger?.error?.('Contribution failed', { groupId, error: msg });
      } finally {
        if (mountedRef.current) setContributing(false);
      }
    },
    [contributionAmount, groupId]
  );

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Spinner label="Loading group details…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600" role="alert">
        {error}
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 text-center text-gray-600">
        Group not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-2 text-center">Group: {group.name}</h2>
      <p className="mb-2">{group.description}</p>
      <p className="mb-2">Total Members: {group.members?.length ?? 0}</p>
      <p className="mb-4 font-semibold">
        Total Contributions: $
        {Number(group.totalContributions || 0).toLocaleString()}
      </p>

      <form onSubmit={handleContribute} className="mb-4">
        <label htmlFor="contributionAmount" className="block mb-2 font-medium">
          Contribute Amount:
        </label>
        <input
          id="contributionAmount"
          type="number"
          value={contributionAmount}
          onChange={(e) => setContributionAmount(e.target.value)}
          className="border p-2 rounded w-full mb-2"
          required
          min="1"
          placeholder="Enter amount"
          disabled={contributing}
          aria-invalid={!!error}
        />
        <button
          type="submit"
          disabled={contributing || !contributionAmount || Number(contributionAmount) < 1}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {contributing ? 'Contributing…' : 'Contribute'}
        </button>
      </form>

      {successMessage && (
        <p className="text-green-600" role="status">
          {successMessage}
        </p>
      )}
    </div>
  );
}
