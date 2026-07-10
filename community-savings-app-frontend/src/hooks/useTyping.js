'use strict';

/**
 * ============================================================================
 * USE TYPING HOOK (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Manages typing indicators in TITechChat conversations.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Emits typing:start / typing:stop events
 * ✅ Auto-stop debounce mechanism
 * ✅ Prevents socket spam
 * ✅ Safe lifecycle handling
 *
 * ARCHITECTURE NOTE
 * ----------------------------------------------------------------------------
 * Typing indicators are:
 * - ephemeral (no persistence)
 * - realtime only
 * - throttled to avoid network abuse
 *
 * ============================================================================
 */

import { useRef, useCallback, useEffect } from 'react';
import { initSocket } from '../sockets/chatSocket';

/*
|--------------------------------------------------------------------------
| Hook: useTyping
|--------------------------------------------------------------------------
*/

export default function useTyping(conversationId) {
  const socket = useRef(null);
  const timeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Initialize Socket Once
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    socket.current = initSocket();

    return () => {
      clearTimeout(timeoutRef.current);
      socket.current = null;
      isTypingRef.current = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Stop Typing
  |--------------------------------------------------------------------------
  */

  const stopTyping = useCallback(() => {
    if (!socket.current || !conversationId) return;

    if (isTypingRef.current) {
      socket.current.emit('typing:stop', {
        conversationId,
      });

      isTypingRef.current = false;
    }

    clearTimeout(timeoutRef.current);
  }, [conversationId]);

  /*
  |--------------------------------------------------------------------------
  | Start Typing (debounced)
  |--------------------------------------------------------------------------
  */

  const startTyping = useCallback(() => {
    if (!socket.current || !conversationId) return;

    if (!isTypingRef.current) {
      socket.current.emit('typing:start', {
        conversationId,
      });

      isTypingRef.current = true;
    }

    /*
    |--------------------------------------------------------------------------
    | Auto-stop after inactivity (debounce)
    |--------------------------------------------------------------------------
    */

    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  }, [conversationId, stopTyping]);

  /*
  |--------------------------------------------------------------------------
  | Force Reset (optional utility)
  |--------------------------------------------------------------------------
  */

  const resetTyping = useCallback(() => {
    stopTyping();
    isTypingRef.current = false;
  }, [stopTyping]);

  /*
  |--------------------------------------------------------------------------
  | Return API
  |--------------------------------------------------------------------------
  */

  return {
    startTyping,
    stopTyping,
    resetTyping,
  };
}