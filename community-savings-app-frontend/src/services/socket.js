// src/services/socket.js
// Export a singleton socket.io client instance

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// create socket instance but do not auto-connect until auth available
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket'],
  withCredentials: true,
});

export default socket;
