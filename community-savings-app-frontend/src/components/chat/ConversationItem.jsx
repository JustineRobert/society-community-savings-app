'use strict';

/**
 * ============================================================================
 * CONVERSATION ITEM COMPONENT (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Renders a single conversation preview item inside TITechChat.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Safe rendering (null/undefined protection)
 * ✅ Human-readable timestamp formatting
 * ✅ Type fallback labeling (LOAN, SAVINGS, SUPPORT, etc.)
 * ✅ Click handler abstraction
 * ✅ Ready for unread badges, avatars, and presence indicators
 *
 * FUTURE EXTENSIONS
 * ----------------------------------------------------------------------------
 * - unread count badge
 * - last message preview
 * - participant avatars
 * - online presence indicator
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';

/*
|--------------------------------------------------------------------------
| Helper: format timestamp safely
|--------------------------------------------------------------------------
*/

function formatDate(date) {
  if (!date) return '';

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString();
}

/*
|--------------------------------------------------------------------------
| Component: ConversationItem
|--------------------------------------------------------------------------
*/

export default function ConversationItem({
  conversation,
  onClick,
}) {
  /*
  |--------------------------------------------------------------------------
  | Derived Values (memoized for performance)
  |--------------------------------------------------------------------------
  */

  const title = useMemo(() => {
    return (
      conversation?.title ||
      conversation?.metadata?.name ||
      conversation?.type ||
      'Untitled Conversation'
    );
  }, [conversation]);

  const subtitle = useMemo(() => {
    return formatDate(conversation?.lastActivityAt);
  }, [conversation]);

  const typeLabel = useMemo(() => {
    return (conversation?.type || '').toUpperCase();
  }, [conversation]);

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div
      className="conversation-item"
      onClick={() => onClick?.(conversation)}
      role="button"
      tabIndex={0}
    >
      {/* Main Title */}
      <div className="title">
        {title}
      </div>

      {/* Metadata Row */}
      <div className="meta">
        {typeLabel && (
          <span style={{ marginRight: '8px', fontWeight: 600 }}>
            {typeLabel}
          </span>
        )}

        {subtitle}
      </div>
    </div>
  );
}