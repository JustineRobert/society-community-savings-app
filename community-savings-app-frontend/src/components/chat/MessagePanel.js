import React from 'react';
import MessageList from './MessageList';
import Composer from './Composer';

const MessagePanel = ({ conversation }) => {
  return (
    <div className="message-panel">
      <MessageList conversationId={conversation.id} />
      <Composer conversationId={conversation.id} />
    </div>
  );
};

export default MessagePanel;
