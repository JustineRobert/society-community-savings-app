'use strict';

/**
 * ============================================================================
 * CONVERSATION LIST COMPONENT (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Renders a list of user conversations in TITechChat.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Empty state handling
 * ✅ Stable list rendering
 * ✅ Click-to-select conversation
 * ✅ Ready for pagination / virtualization upgrade
 *
 * ARCHITECTURE NOTE
 * ----------------------------------------------------------------------------
 * This component is presentation-only:
 * - No API calls
 * - No socket logic
 * - No business rules
 *
 * ============================================================================
 */

import React from 'react';
import ConversationItem from './ConversationItem';

/*
|--------------------------------------------------------------------------
| Component: ConversationList
|--------------------------------------------------------------------------
*/

export default function ConversationList({
  conversations = [],
  onSelect,
}) {
  /*
  |--------------------------------------------------------------------------
  | Empty State
  |--------------------------------------------------------------------------
  */

  if (!conversations || conversations.length === 0) {
    return (
      <div style={{ padding: '12px', color: '#888' }}>
        No conversations available
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render List
  |--------------------------------------------------------------------------
  */

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => {
        if (!conversation?._id) return null;

        return (
          <ConversationItem
            key={conversation._id}
            conversation={conversation}
            onClick={() => onSelect?.(conversation)}
          />
        );
      })}
    </div>
  );
}
