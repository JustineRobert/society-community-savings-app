'use strict';

/**
 * ============================================================================
 * USE CHAT HOOK (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Central React hook for loading and managing chat conversations.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Loads user conversations
 * ✅ Initializes socket connection
 * ✅ Maintains local reactive state
 * ✅ Safe async lifecycle handling
 * ✅ Ready for real-time extension (socket events)
 *
 * ARCHITECTURE NOTE
 * ----------------------------------------------------------------------------
 * This hook is intentionally thin:
 * - API calls handled in service layer
 * - Real-time handled via socket layer
 * - State orchestration only
 *
 * ============================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import { fetchConversations } from '../services/chatService';
import { initSocket, on, off } from '../sockets/chatSocket';

/*
|--------------------------------------------------------------------------
| Hook: useChat
|--------------------------------------------------------------------------
*/

export default function useChat() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load Conversations
  |--------------------------------------------------------------------------
  */

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchConversations();

      setConversations(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Initialize Chat System
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    if (!mounted) return;

    // Load initial data
    loadConversations();

    // Initialize socket connection
    const socket = initSocket();

    /*
    |--------------------------------------------------------------------------
    | Real-time Event Hooks (Future-ready)
    |--------------------------------------------------------------------------
    */

    const handleNewMessage = (message) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === message.conversationId
            ? {
                ...conv,
                lastMessage: message,
                lastActivityAt: new Date(),
              }
            : conv
        )
      );
    };

    const handleConversationUpdate = (update) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === update._id ? { ...conv, ...update } : conv
        )
      );
    };

    /*
    |--------------------------------------------------------------------------
    | Register Socket Events
    |--------------------------------------------------------------------------
    */

    on('message:new', handleNewMessage);
    on('conversation:update', handleConversationUpdate);

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    return () => {
      mounted = false;

      off('message:new', handleNewMessage);
      off('conversation:update', handleConversationUpdate);
    };
  }, [loadConversations]);

  /*
  |--------------------------------------------------------------------------
  | Manual Refresh
  |--------------------------------------------------------------------------
  */

  const refresh = useCallback(() => {
    return loadConversations();
  }, [loadConversations]);

  /*
  |--------------------------------------------------------------------------
  | Return Hook State
  |--------------------------------------------------------------------------
  */

  return {
    conversations,
    setConversations,
    loading,
    error,
    refresh,
  };
}
