// ============================================================================
// TITech Community Capital – ConversationDetail
// File: frontend/src/pages/ConversationDetail.jsx
// ============================================================================
//
// Production-grade conversation detail view:
// - Defensive data access and loading states
// - Fetches conversation if not present in store
// - Shows header with participants, status, and actions
// - Accessible layout and keyboard shortcuts
// - Memoized rendering and error boundary for resilience
// - Integrates with existing MessagePanel component
//
// Drop-in replacement for frontend/src/pages/ConversationDetail.js
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import MessagePanel from '../components/chat/MessagePanel';
import { fetchConversationById, markConversationRead } from '../store/chat/actions'; // adjust import to your store layout
import { selectConversationById, selectActiveConversationId } from '../store/chat/selectors';
import Spinner from '../components/ui/Spinner'; // optional: replace with your spinner
import logger from '../../utils/logger'; // optional: client-side logger wrapper

// Small error boundary to avoid crashing the whole app if MessagePanel throws
class ConversationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log error to client logger
    try {
      logger?.error?.('ConversationDetail render error', { error: error?.message, info });
    } catch (_) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-4 bg-red-50 text-red-700 rounded">
          <strong>Something went wrong loading this conversation.</strong>
          <div className="mt-2 text-sm">Try refreshing the page or selecting another conversation.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

ConversationErrorBoundary.propTypes = {
  children: PropTypes.node,
};

// Main component
const ConversationDetail = ({ conversationId: propConversationId }) => {
  const dispatch = useDispatch();

  // Active conversation id may come from redux or prop (route param)
  const activeConversationIdFromStore = useSelector(selectActiveConversationId);
  const conversationId = propConversationId || activeConversationIdFromStore;

  // Select conversation from store by id
  const conversation = useSelector((state) =>
    conversationId ? selectConversationById(state, conversationId) : null
  );

  const [localLoading, setLocalLoading] = useState(false);
  const mountedRef = useRef(true);

  // Memoized participants display
  const participantsLabel = useMemo(() => {
    if (!conversation) return '';
    const names = (conversation.participants || []).map((p) => p.name || p.email || p.id);
    if (names.length === 0) return 'No participants';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names[0]} and ${names.length - 1} others`;
  }, [conversation]);

  // Fetch conversation if missing
  const loadConversation = useCallback(
    async (id) => {
      if (!id) return;
      try {
        setLocalLoading(true);
        await dispatch(fetchConversationById(id));
      } catch (err) {
        logger?.warn?.('Failed to fetch conversation', { id, error: err?.message });
      } finally {
        if (mountedRef.current) setLocalLoading(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    mountedRef.current = true;
    if (conversationId && !conversation) {
      loadConversation(conversationId);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [conversationId, conversation, loadConversation]);

  // Mark conversation read when opened
  useEffect(() => {
    if (!conversationId || !conversation) return;
    // mark read only if there are unread messages
    const unread = conversation.unreadCount || 0;
    if (unread > 0) {
      dispatch(markConversationRead(conversationId)).catch((err) =>
        logger?.warn?.('Failed to mark conversation read', { conversationId, error: err?.message })
      );
    }
  }, [conversationId, conversation, dispatch]);

  // Keyboard shortcut: press "Esc" to go back to conversation list
  const navigateBack = useCallback(() => {
    // If you use react-router navigate, you can call navigate(-1) here.
    // For a generic approach, dispatch an action to clear active conversation.
    try {
      dispatch({ type: 'chat/clearActiveConversation' });
    } catch (_) {}
  }, [dispatch]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') navigateBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateBack]);

  // Render states
  if (!conversationId && !localLoading) {
    return (
      <div className="p-6 text-center text-gray-600">
        <p className="text-lg font-medium">No conversation selected</p>
        <p className="text-sm mt-2">Select a conversation from the list to view messages.</p>
      </div>
    );
  }

  if (localLoading || (!conversation && conversationId)) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Spinner size="lg" label="Loading conversation…" />
      </div>
    );
  }

  // Defensive: if conversation exists but has minimal data, show header and message panel
  return (
    <ConversationErrorBoundary>
      <div className="flex flex-col h-full min-h-[400px] bg-white shadow-sm rounded">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {/* Avatar group: show first participant avatar or fallback */}
              <div
                aria-hidden
                className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold"
              >
                {conversation?.participants?.[0]?.name?.[0]?.toUpperCase() || 'C'}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-900">
                {conversation?.title || participantsLabel || 'Conversation'}
              </div>
              <div className="text-xs text-gray-500">{participantsLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {conversation?.status ? conversation.status : 'active'}
            </span>

            <button
              type="button"
              onClick={() => {
                // Example action: archive conversation
                dispatch({ type: 'chat/archiveConversation', payload: { id: conversationId } });
              }}
              className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
              aria-label="Archive conversation"
            >
              Archive
            </button>

            <button
              type="button"
              onClick={() => navigateBack()}
              className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
              aria-label="Close conversation"
            >
              Close
            </button>
          </div>
        </header>

        {/* Message panel */}
        <main className="flex-1 overflow-hidden">
          <MessagePanel conversation={conversation} />
        </main>
      </div>
    </ConversationErrorBoundary>
  );
};

ConversationDetail.propTypes = {
  conversationId: PropTypes.string,
};

ConversationDetail.defaultProps = {
  conversationId: null,
};

export default React.memo(ConversationDetail);