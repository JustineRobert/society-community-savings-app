'use strict';

/**
 * ============================================================================
 * USE CONVERSATION HOOK (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Manages a single conversation view including:
 * - conversation metadata
 * - messages stream
 * - realtime updates via socket
 * - message sending
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Loads conversation data
 * ✅ Manages message state
 * ✅ Real-time message updates
 * ✅ Room join/leave lifecycle
 * ✅ Safe async cleanup
 *
 * ARCHITECTURE NOTE
 * ----------------------------------------------------------------------------
 * Hook = orchestration layer only
 * - API logic → chatService
 * - realtime → chatSocket
 * - business rules → backend
 *
 * ============================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import {
  fetchConversation,
  postMessage,
} from '../services/chatService';

import {
  initSocket,
  joinRoom,
  leaveRoom,
  on,
  off,
} from '../sockets/chatSocket';

/*
|--------------------------------------------------------------------------
| Hook: useConversation
|--------------------------------------------------------------------------
*/

export default function useConversation(conversationId) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load Conversation
  |--------------------------------------------------------------------------
  */

  const loadConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);

      const data = await fetchConversation(conversationId);

      setConversation(data || null);
      setMessages(data?.messages || []);
    } catch (err) {
      setError(
        err?.message || 'Failed to load conversation'
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  /*
  |--------------------------------------------------------------------------
  | Real-time Message Handler
  |--------------------------------------------------------------------------
  */

  const handleNewMessage = useCallback(
    (msg) => {
      if (!msg || msg.conversationId !== conversationId) return;

      setMessages((prev) => [...prev, msg]);
    },
    [conversationId]
  );

  /*
  |--------------------------------------------------------------------------
  | Initialize Conversation Lifecycle
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    if (!conversationId) return;

    // Load initial data
    loadConversation();

    // Initialize socket
    initSocket();

    // Join room
    joinRoom(conversationId);

    // Subscribe to realtime events
    on('message:new', handleNewMessage);

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    return () => {
      mounted = false;

      leaveRoom(conversationId);

      off('message:new', handleNewMessage);
    };
  }, [conversationId, loadConversation, handleNewMessage]);

  /*
  |--------------------------------------------------------------------------
  | Send Message
  |--------------------------------------------------------------------------
  */

  const sendMessage = useCallback(
    async (body, attachments = []) => {
      try {
        const msg = await postMessage({
          conversationId,
          body,
          attachments,
        });

        // Optimistic update (optional but enterprise-safe fallback)
        setMessages((prev) => [...prev, msg]);

        return msg;
      } catch (err) {
        setError(err?.message || 'Failed to send message');
        throw err;
      }
    },
    [conversationId]
  );

  /*
  |--------------------------------------------------------------------------
  | Return Hook State
  |--------------------------------------------------------------------------
  */

  return {
    conversation,
    messages,
    setMessages,
    sendMessage,
    loading,
    error,
    refresh: loadConversation,
  };
}