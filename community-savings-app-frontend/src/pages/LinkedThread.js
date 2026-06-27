// ============================================================================
// TITech Community Capital – Linked Thread Page
// File: frontend/src/pages/LinkedThread.js
// Production-grade
// ============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import logger from '../../utils/logger';
import { toast } from 'react-toastify';

/**
 * LinkedThread
 *
 * - Fetches a thread and its linked replies from backend API
 * - Displays thread details and messages
 * - Defensive error handling, loading states, and accessible markup
 */
export default function LinkedThread() {
  const { threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const fetchThread = useCallback(async () => {
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
      const res = await api.get(`/api/threads/${threadId}`, {
        signal: abortRef.current.signal,
      });
      const data = res?.data?.data || res?.data || null;
      if (mountedRef.current) setThread(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.message || err?.message || 'Failed to load thread';
      setError(msg);
      toast.error(msg);
      logger?.warn?.('LinkedThread fetch failed', { threadId, error: msg });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchThread();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, [fetchThread]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Spinner label="Loading thread…" />
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

  if (!thread) {
    return (
      <div className="p-6 text-center text-gray-600">
        Thread not found.
      </div>
    );
  }

  return (
    <section
      className="linked-thread p-6 max-w-3xl mx-auto bg-white shadow rounded"
      aria-labelledby="thread-heading"
    >
      <header className="mb-4">
        <h2 id="thread-heading" className="text-2xl font-bold mb-2">
          {thread.title || 'Untitled Thread'}
        </h2>
        <p className="text-sm text-gray-500">
          Created by {thread.author?.name || 'Unknown'} •{' '}
          {thread.createdAt ? new Date(thread.createdAt).toLocaleString() : ''}
        </p>
      </header>

      <article className="mb-6">
        <p className="text-gray-800 whitespace-pre-line">
          {thread.content || 'No content available.'}
        </p>
      </article>

      <div className="linked-replies space-y-4">
        <h3 className="text-lg font-semibold mb-2">Replies</h3>
        {Array.isArray(thread.replies) && thread.replies.length > 0 ? (
          thread.replies.map((reply) => (
            <div
              key={reply._id}
              className="p-3 border border-gray-200 rounded bg-gray-50"
            >
              <p className="text-sm text-gray-700 mb-1">
                <strong>{reply.author?.name || 'Anonymous'}:</strong>
              </p>
              <p className="text-gray-800 whitespace-pre-line">{reply.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}
              </p>
            </div>
          ))
        ) : (
          <p className="text-gray-600">No replies yet.</p>
        )}
      </div>
    </section>
  );
}
