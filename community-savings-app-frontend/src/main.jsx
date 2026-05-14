import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Suppress noisy WebSocket connection errors from dev tooling by
// overriding console.error temporarily during initial mount when
// non-actionable WebSocket errors may be emitted by injected clients.
const originalConsoleError = console.error;
console.error = (...args) => {
  try {
    const first = String(args[0] || '');
    if (first.includes('WebSocket connection to') && first.includes('failed')) {
      // ignore these noisy failures in dev
      return;
    }
  } catch (e) {
    // fall through
  }
  originalConsoleError.apply(console, args);
};

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// restore console.error after mount
setTimeout(() => { console.error = originalConsoleError; }, 3000);
