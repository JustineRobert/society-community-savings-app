'use strict';

/**
 * ============================================================================
 * MESSAGE BUBBLE COMPONENT (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Renders an individual chat message inside TITechChat.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Safe rendering (null protection)
 * ✅ Ownership detection (mine vs others)
 * ✅ Timestamp formatting with validation
 * ✅ Support for system/announcement message styling
 * ✅ Ready for attachments, read receipts, reactions
 *
 * SECURITY NOTE
 * ----------------------------------------------------------------------------
 * Never trust senderId === "me".
 * Production apps must use authenticated userId comparison.
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatTime(date) {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString();
}

/*
|--------------------------------------------------------------------------
| Component: MessageBubble
|--------------------------------------------------------------------------
*/

export default function MessageBubble({
  message,
  currentUserId, // optional: inject from hook/context in production
}) {
  /*
  |--------------------------------------------------------------------------
  | Derived State
  |--------------------------------------------------------------------------
  */

  const isMine = useMemo(() => {
    if (!message) return false;

    // Preferred secure comparison
    if (currentUserId) {
      return String(message.senderId) === String(currentUserId);
    }

    // Fallback (NOT production-safe, kept for compatibility)
    return message.senderId === 'me';
  }, [message, currentUserId]);

  const isSystem = useMemo(() => {
    return message?.messageType === 'system';
  }, [message]);

  const isAnnouncement = useMemo(() => {
    return message?.messageType === 'announcement';
  }, [message]);

  const time = useMemo(() => {
    return formatTime(message?.createdAt);
  }, [message]);

  /*
|--------------------------------------------------------------------------
| Render
|--------------------------------------------------------------------------
*/

  if (!message) return null;

  return (
    <div
      className={[
        'message-bubble',
        isMine ? 'mine' : 'theirs',
        isSystem ? 'system' : '',
        isAnnouncement ? 'announcement' : '',
      ].join(' ')}
    >
      {/* Message Body */}
      <div className="body">
        {message.body}
      </div>

      {/* Attachments (future-ready placeholder) */}
      {Array.isArray(message.attachments) && message.attachments.length > 0 && (
        <div className="attachments">
          {message.attachments.map((att, idx) => (
            <div key={idx} className="attachment">
              {att.filename || att.url}
            </div>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="meta">
        {time}
      </div>
    </div>
  );
}