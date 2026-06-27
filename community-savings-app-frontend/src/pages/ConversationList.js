// ============================================================================
// TITech Community Capital – ConversationList
// File: frontend/src/pages/ConversationList.jsx
// Production-grade conversation list with loading, search, pagination,
// defensive rendering, and accessibility.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import ConversationItem from '../components/chat/ConversationItem';
import Spinner from '../components/ui/Spinner'; // replace with your app spinner
import { fetchConversations } from '../store/chat/actions'; // adjust to your store layout
import { selectConversations, selectConversationsLoading } from '../store/chat/selectors';
import logger from '../../utils/logger';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function ConversationList({ initialPageSize = 10, showSearch = true }) {
  const dispatch = useDispatch();

  // Selectors (adjust names to your store)
  const conversations = useSelector(selectConversations) ?? [];
  const loading = useSelector(selectConversationsLoading) ?? false;

  // Local UI state
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  // Fetch conversations on mount if not present
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!conversations || conversations.length === 0) {
          await dispatch(fetchConversations());
        }
      } catch (err) {
        // Log but don't crash UI
        logger?.warn?.('Failed to fetch conversations', { error: err?.message });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [dispatch]); // intentionally only run once on mount

  // Normalize and memoize list for search/sort
  const normalized = useMemo(() => {
    return (conversations || []).map((c, i) => ({
      id: c.id ?? c._id ?? `conv-${i}`,
      title: c.title ?? c.subject ?? c.name ?? 'Conversation',
      lastMessage: c.lastMessage ?? c.preview ?? '',
      updatedAt: c.updatedAt ?? c.lastUpdated ?? c.modifiedAt ?? null,
      unreadCount: c.unreadCount ?? c.unread ?? 0,
      participants: c.participants ?? c.members ?? [],
      raw: c,
    }));
  }, [conversations]);

  // Filter by query
  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((row) => {
      return (
        String(row.title).toLowerCase().includes(q) ||
        String(row.lastMessage).toLowerCase().includes(q) ||
        String(row.participants?.map((p) => p.name || p.email).join(' ')).toLowerCase().includes(q)
      );
    });
  }, [normalized, query]);

  // Pagination calculations
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  // Reset page when query or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  // Render states
  if (loading && (!conversations || conversations.length === 0)) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Spinner label="Loading conversations…" />
      </div>
    );
  }

  return (
    <section aria-labelledby="conversations-heading" className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 id="conversations-heading" className="text-lg font-semibold">
          Conversations
        </h2>

        <div className="flex items-center gap-3">
          {showSearch && (
            <input
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations, messages, participants..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border rounded px-2 py-1"
            />
          )}

          <label className="text-sm text-gray-600 flex items-center gap-2">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border rounded px-2 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        {pageRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-600">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner size="sm" label="Loading…" />
                <span>Loading conversations…</span>
              </div>
            ) : (
              <div>
                <p className="mb-2">No conversations found.</p>
                {query ? (
                  <p className="text-xs text-gray-500">Try a different search term.</p>
                ) : (
                  <p className="text-xs text-gray-500">Start a conversation to see it here.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <ul role="list" className="divide-y">
            {pageRows.map((conv) => (
              <li key={conv.id}>
                <ConversationItem conversation={conv.raw} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination controls */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing <strong>{pageRows.length}</strong> of <strong>{total}</strong>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={pageSafe === 1}
            aria-label="First page"
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe === 1}
            aria-label="Previous page"
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ‹
          </button>

          <span className="text-sm px-2">
            Page <strong>{pageSafe}</strong> / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe === totalPages}
            aria-label="Next page"
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={pageSafe === totalPages}
            aria-label="Last page"
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
}

ConversationList.propTypes = {
  initialPageSize: PropTypes.number,
  showSearch: PropTypes.bool,
};
