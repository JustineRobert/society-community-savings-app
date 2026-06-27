// ============================================================================
// TITech Community Capital – Fraud Monitor Page
// File: frontend/src/pages/FraudMonitor.jsx
// Production-grade
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Spinner from '../components/ui/Spinner'; // optional spinner component
import logger from '../../utils/logger';

/**
 * FraudMonitor
 *
 * - Fetches fraud alerts from backend API
 * - Auto-refreshes every 30s with AbortController support
 * - Displays alerts with severity indicators and accessible markup
 * - Defensive error handling and bounded list rendering
 */
export default function FraudMonitor({ pollIntervalMs = 30000 }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {}
    }
    abortRef.current = new AbortController();

    try {
      const res = await axios.get('/api/fraud/alerts', {
        signal: abortRef.current.signal,
        timeout: 20000,
      });
      const data = Array.isArray(res.data) ? res.data : [];
      if (mountedRef.current) {
        setAlerts(data.slice(-200)); // keep bounded list
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.message || err?.message || 'Failed to load alerts';
      setError(msg);
      logger?.warn?.('FraudMonitor fetch failed', { error: msg });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAlerts();

    const interval = setInterval(fetchAlerts, pollIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, [fetchAlerts, pollIntervalMs]);

  return (
    <section className="fraud-monitor card p-4" aria-labelledby="fraud-monitor-heading">
      <header className="flex items-center justify-between mb-3">
        <h2 id="fraud-monitor-heading" className="text-lg font-semibold">
          Fraud Monitoring
        </h2>
        <button
          type="button"
          onClick={fetchAlerts}
          className="btn-secondary text-sm"
          disabled={loading}
          aria-disabled={loading}
        >
          Refresh
        </button>
      </header>

      {loading && (
        <div className="p-3 text-center">
          <Spinner label="Loading alerts…" />
        </div>
      )}

      {error && (
        <div role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2 max-h-[480px] overflow-auto">
        {alerts.length === 0 && !loading ? (
          <p className="text-sm text-gray-500">No fraud alerts at this time.</p>
        ) : (
          alerts.map((a) => (
            <div
              key={a.id}
              className={`p-2 rounded border ${
                a.severity === 'high'
                  ? 'border-red-600 bg-red-50 text-red-700'
                  : a.severity === 'medium'
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-gray-300 bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span role="img" aria-label="alert">
                  🚨
                </span>
                <span className="font-medium">{a.message}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(a.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

FraudMonitor.propTypes = {
  pollIntervalMs: PropTypes.number,
};