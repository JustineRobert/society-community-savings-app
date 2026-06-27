// ============================================================================
// TITech Community Capital – TITechChat Page
// File: frontend/src/pages/TITechChat.jsx
// Production-grade
// ============================================================================

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import Spinner from '../components/ui/Spinner';
import logger from '../../utils/logger';
import {
  fetchConversations,
  setActiveConversation,
  selectActiveConversationId,
  selectConversationsLoading,
  selectConversationsSummary,
} from '../store/chat'; // adjust imports to your store layout

// Lazy-load heavy components to speed initial render
const ConversationList = React.lazy(() => import('../components/chat/ConversationList'));
const ConversationDetail = React.lazy(() => import('../components/chat/ConversationDetail'));

/**
 * TITechChat
 *
 * - Responsive two-column chat layout (list + detail)
 * - Lazy loads heavy components and shows accessible fallback
 * - Keyboard navigation: ArrowUp/ArrowDown to move selection, Enter to open
 * - Graceful handling when no conversation is selected
 * - Integrates with Redux store for data and actions
 * - Memoized and resilient to missing data
 */
function TITechChat({ initialConversationId = null }) {
  const dispatch = useDispatch();
  const activeConversationId = useSelector(selectActiveConversationId);
  const loading = useSelector(selectConversationsLoading);
  const conversationsSummary = useSelector(selectConversationsSummary);
  const [isListVisibleOnMobile, setIsListVisibleOnMobile] = useState(true);
  const listRef = useRef(null);

  // Ensure conversations are loaded on mount
  useEffect(() => {
    (async () => {
      try {
        await dispatch(fetchConversations());
      } catch (err) {
        logger?.warn?.('Failed to fetch conversations on TITechChat mount', { error: err?.message });
      }
    })();
  }, [dispatch]);

  // If an initialConversationId prop is provided, set it
  useEffect(() => {
    if (initialConversationId && !activeConversationId) {
      dispatch(setActiveConversation(initialConversationId));
    }
  }, [initialConversationId, activeConversationId, dispatch]);

  // Build an ordered list of conversation ids for keyboard navigation
  const conversationIds = useMemo(
    () => (Array.isArray(conversationsSummary) ? conversationsSummary.map((c) => c.id) : []),
    [conversationsSummary]
  );

  // Keyboard navigation handler
  const onKeyDown = useCallback(
    (e) => {
      if (!conversationIds.length) return;
      const idx = conversationIds.indexOf(activeConversationId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.min(conversationIds.length - 1, idx + 1);
        dispatch(setActiveConversation(conversationIds[next]));
        // ensure list item is visible
        try {
          const el = document.querySelector(`[data-conversation-id="${conversationIds[next]}"]`);
          el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx < 0 ? 0 : Math.max(0, idx - 1);
        dispatch(setActiveConversation(conversationIds[prev]));
        try {
          const el = document.querySelector(`[data-conversation-id="${conversationIds[prev]}"]`);
          el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
      } else if (e.key === 'Enter') {
        // On Enter, ensure detail pane is visible on mobile
        if (window.innerWidth < 768) {
          setIsListVisibleOnMobile(false);
        }
      } else if (e.key === 'Escape') {
        // On Escape, show list on mobile
        if (window.innerWidth < 768) {
          setIsListVisibleOnMobile(true);
        }
      }
    },
    [conversationIds, activeConversationId, dispatch]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Toggle list visibility for mobile
  const toggleList = useCallback(() => {
    setIsListVisibleOnMobile((v) => !v);
  }, []);

  // Fallback UI for Suspense
  const fallback = (
    <div className="flex items-center justify-center p-6">
      <Spinner label="Loading chat…" />
    </div>
  );

  return (
    <main className="titech-chat h-full min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto h-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* Left column: conversation list (collapsible on mobile) */}
        <aside
          ref={listRef}
          className={`col-span-1 md:col-span-1 bg-white rounded shadow-sm overflow-hidden transition-transform duration-200 ${
            isListVisibleOnMobile ? 'block' : 'hidden'
          } md:block`}
          aria-label="Conversations"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch(fetchConversations())}
                className="text-xs text-gray-600 hover:text-gray-900"
                aria-label="Refresh conversations"
                title="Refresh"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={toggleList}
                className="md:hidden text-xs text-gray-600 hover:text-gray-900"
                aria-label="Toggle conversation list"
                title="Toggle list"
              >
                {isListVisibleOnMobile ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="h-[calc(100vh-120px)] overflow-auto">
            <Suspense fallback={fallback}>
              <ConversationList />
            </Suspense>
            {loading && (
              <div className="p-3 text-center text-sm text-gray-500">
                <Spinner size="sm" label="Loading…" />
              </div>
            )}
          </div>
        </aside>

        {/* Right column: conversation detail */}
        <section
          className="col-span-1 md:col-span-2 bg-white rounded shadow-sm overflow-hidden flex flex-col"
          aria-label="Conversation detail"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h2 className="text-sm font-semibold">
                {activeConversationId ? 'Conversation' : 'No conversation selected'}
              </h2>
              <p className="text-xs text-gray-500">
                {activeConversationId ? 'Messages and actions' : 'Select a conversation to begin'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* On small screens show back to list button */}
              <button
                type="button"
                onClick={() => setIsListVisibleOnMobile(true)}
                className="text-xs text-gray-600 hover:text-gray-900 md:hidden"
                aria-label="Show conversation list"
              >
                Back to list
              </button>
            </div>
          </div>

          <div className="flex-1 h-[calc(100vh-120px)] overflow-auto">
            <Suspense fallback={fallback}>
              <ConversationDetail />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

TITechChat.propTypes = {
  initialConversationId: PropTypes.string,
};

TITechChat.defaultProps = {
  initialConversationId: null,
};

export default React.memo(TITechChat);
