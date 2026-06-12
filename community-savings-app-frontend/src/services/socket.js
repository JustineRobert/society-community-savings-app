// src/services/socket.js
// Socket.IO client initialization with JWT injection (frontend version)

import { io } from 'socket.io-client';

/**
 * Retrieve JWT token from localStorage (or sessionStorage).
 * Adjust this function if you store tokens differently (e.g., cookies).
 */
function getToken() {
  return localStorage.getItem('accessToken'); // replace with your token key
}

// Create socket instance with JWT injection
const socket = io('http://localhost:5000', {
  withCredentials: true,
  transports: ['websocket'],
  autoConnect: false, // prevent auto-connect until token is set
  auth: {
    token: getToken(), // send token during handshake
  },
});

// Utility: reconnect with updated token after login/refresh
export function connectSocket() {
  socket.auth = { token: getToken() };
  socket.connect();
}

export default socket;
