import React from 'react';
import { useSelector } from 'react-redux';
import MessagePanel from '../components/chat/MessagePanel';

const ConversationDetail = () => {
  const activeConversation = useSelector(state => state.chat.activeConversation);

  if (!activeConversation) {
    return <p>Select a conversation to view messages</p>;
  }

  return (
    <div className="conversation-detail">
      <MessagePanel conversation={activeConversation} />
    </div>
  );
};

export default ConversationDetail;
