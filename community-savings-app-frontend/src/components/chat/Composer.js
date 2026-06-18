import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { sendMessage } from '../../store/chatSlice';

const Composer = ({ conversationId }) => {
  const [text, setText] = useState('');
  const dispatch = useDispatch();

  const handleSend = () => {
    if (text.trim()) {
      dispatch(sendMessage({ conversationId, body: text }));
      setText('');
    }
  };

  return (
    <div className="composer">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

export default Composer;
