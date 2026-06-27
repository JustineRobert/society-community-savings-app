// ============================================================================
// TITech Community Capital – Audit Logs Page
// File: frontend/src/pages/AuditLogs.jsx
// ============================================================================

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Production-grade AuditLogs table
 *
 * Features
 * - Accessible table with keyboard focus and ARIA attributes
 * - Client-side search, sort, and pagination
 * - Lightweight, dependency-free (no external table libs)
 * - Safe rendering and defensive defaults
 *
 * Usage:
 * <AuditLogs logs={logsArray} pageSizeOptions={[10,25,50]} />
 */

function formatTimestamp(ts) {
  if (!ts) return '-';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default function AuditLogs({
  logs = [],
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 10,
  onRowClick = null,
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const normalizedLogs = useMemo(
    () =>
      Array.isArray(logs)
        ? logs.map((l, i) => ({
            id: l.id ?? l._id ?? `log-${i}`,
            event: l.event ?? l.action ?? l.type ?? '',
            user: l.user ?? l.userId ?? l.actor ?? 'system',
            timestamp: l.timestamp ?? l.createdAt ?? l.time ?? null,
            details: l.details ?? l.meta ?? l.payload ?? null,
            raw: l,
          }))
        : [],
    [logs]
  );

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return normalizedLogs;
    return normalizedLogs.filter((row) => {
      return (
        String(row.event).toLowerCase().includes(q) ||
        String(row.user).toLowerCase().includes(q) ||
        String(row.details ?? '').toLowerCase().includes(q) ||
        String(row.id).toLowerCase().includes(q)
      );
    });
  }, [normalizedLogs, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === 'asc' ? -1 : 1;
      if (bv == null) return sortDir === 'asc' ? 1 : -1;

      // timestamp numeric/date sort
      if (sortKey === 'timestamp') {
        const at = new Date(av).getTime();
        const bt = new Date(bv).getTime();
        return sortDir === 'asc' ? at - bt : bt - at;
      }

      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  return (
    <section aria-labelledby="audit-logs-heading" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 id="audit-logs-heading" className="text-lg font-semibold">
          Audit Logs
        </h2>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600" htmlFor="audit-search">
            Search
          </label>
          <input
            id="audit-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search event, user, details..."
            className="border rounded px-2 py-1"
            aria-label="Search audit logs"
          />
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow-sm">
        <table className="min-w-full table-auto" role="table" aria-describedby="audit-logs-heading">
          <caption className="sr-only">Audit log entries</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left px-4 py-2 cursor-pointer"
                onClick={() => toggleSort('event')}
                aria-sort={sortKey === 'event' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Event {sortKey === 'event' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                scope="col"
                className="text-left px-4 py-2 cursor-pointer"
                onClick={() => toggleSort('user')}
                aria-sort={sortKey === 'user' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                User {sortKey === 'user' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                scope="col"
                className="text-left px-4 py-2 cursor-pointer"
                onClick={() => toggleSort('timestamp')}
                aria-sort={sortKey === 'timestamp' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Time {sortKey === 'timestamp' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th scope="col" className="text-left px-4 py-2">
                Details
              </th>
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-600">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onRowClick && onRowClick(row)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && onRowClick) onRowClick(row);
                  }}
                  className="hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm font-medium text-gray-900">{row.event || '-'}</div>
                    <div className="text-xs text-gray-500">{row.id}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-gray-700">{row.user || '-'}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-gray-600">{formatTimestamp(row.timestamp)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-gray-700 truncate" title={String(row.details ?? '')}>
                      {row.details ? String(row.details) : '-'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Showing <strong>{pageRows.length}</strong> of <strong>{total}</strong>
          </span>

          <label className="text-sm text-gray-600 flex items-center gap-2">
            Per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={pageSafe === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
            aria-label="Previous page"
          >
            ‹
          </button>

          <span className="text-sm text-gray-700 px-2">
            Page <strong>{pageSafe}</strong> / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={pageSafe === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
}

AuditLogs.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.object),
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  initialPageSize: PropTypes.number,
  onRowClick: PropTypes.func,
};
