import React from 'react';
import { useSelector } from 'react-redux';
import ConversationItem from '../components/chat/ConversationItem';

const ConversationList = () => {
  const conversations = useSelector(state => state.chat.conversations);

  return (
    <div className="conversation-list">
      {conversations.length === 0 ? (
        <p>No conversations yet</p>
      ) : (
        conversations.map(conv => (
          <ConversationItem key={conv.id} conversation={conv} />
        ))
      )}
    </div>
  );
};

export default ConversationList;
