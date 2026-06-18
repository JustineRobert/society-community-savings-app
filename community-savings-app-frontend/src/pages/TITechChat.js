import React from 'react';
import ConversationList from '../components/chat/ConversationList';
import ConversationDetail from '../components/chat/ConversationDetail';

const TITechChat = () => {
  return (
    <div className="chat-container">
      <ConversationList />
      <ConversationDetail />
    </div>
  );
};

export default TITechChat;
