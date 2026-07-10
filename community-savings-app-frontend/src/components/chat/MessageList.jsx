'use strict';

/**
 * ============================================================================
 * MESSAGE LIST COMPONENT (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Renders a scrollable list of chat messages inside a conversation thread.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Defensive rendering (null-safe)
 * ✅ Stable keys for React reconciliation
 * ✅ Empty state handling
 * ✅ Future-ready for virtualization (large threads)
 * ✅ Separation of concerns (pure UI component)
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import MessageBubble from './MessageBubble';

/*
|--------------------------------------------------------------------------
| Component: MessageList
|--------------------------------------------------------------------------
*/

export default function MessageList({
  messages = [],
}) {
  /*
  |--------------------------------------------------------------------------
  | Memoized Empty State
  |--------------------------------------------------------------------------
  */

  const isEmpty = useMemo(() => {
    return !messages || messages.length === 0;
  }, [messages]);

  /*
  |--------------------------------------------------------------------------
  | Render Empty State
  |--------------------------------------------------------------------------
  */

  if (isEmpty) {
    return (
      <div className="message-list empty-state">
        No messages yet
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render Messages
  |--------------------------------------------------------------------------
  */

  return (
    <div className="message-list">
      {messages.map((message) => {
        if (!message?._id) return null;

        return (
          <MessageBubble
            key={message._id}
            message={message}
          />
        );
      })}
    </div>
  );
}