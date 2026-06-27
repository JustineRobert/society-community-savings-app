// ============================================================================
// TITech Community Capital – Main Entry Point
// File: frontend/src/main.jsx
// Production-grade
// ============================================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// Suppress noisy WebSocket connection errors from dev tooling by
// overriding console.error temporarily during initial mount when
// non-actionable WebSocket errors may be emitted by injected clients.
const originalConsoleError = console.error;
console.error = (...args) => {
  try {
    const first = String(args[0] || '');
    if (first.includes('WebSocket connection to') && first.includes('failed')) {
      return; // swallow non-actionable dev-tooling errors
    }
  } catch (_) {
    // ignore parsing errors
  }
  originalConsoleError.apply(console, args);
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in index.html');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Restore console.error after mount to avoid suppressing real errors
setTimeout(() => {
  console.error = originalConsoleError;
}, 3000);