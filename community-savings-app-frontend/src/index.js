// ============================================================================
// TITech Community Capital
// React Application Bootstrap
// Production Grade
// ============================================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';

// Optional global styles
import './index.css';

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================

window.addEventListener('unhandledrejection', (event) => {
  console.error(
    '[Unhandled Promise Rejection]',
    event.reason
  );
});

window.addEventListener('error', (event) => {
  console.error(
    '[Global Error]',
    event.error || event.message
  );
});

// ============================================================================
// CONSOLE FILTERING
// ============================================================================

const originalConsoleError = console.error;

console.error = (...args) => {
  try {
    const message = String(args?.[0] || '');

    /**
     * Ignore noisy websocket startup failures
     * while backend is still booting.
     */
    if (
      message.includes('WebSocket connection to') &&
      message.includes('failed')
    ) {
      return;
    }

    /**
     * Ignore React DevTools browser noise
     */
    if (
      message.includes(
        '.well-known/appspecific/com.chrome.devtools.json'
      )
    ) {
      return;
    }
  } catch (_) {}

  originalConsoleError.apply(console, args);
};

// Restore original console after startup
setTimeout(() => {
  console.error = originalConsoleError;
}, 5000);

// ============================================================================
// ROOT ELEMENT VALIDATION
// ============================================================================

const rootElement =
  document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'React root element #root not found'
  );
}

// ============================================================================
// REACT ROOT
// ============================================================================

const root = createRoot(rootElement);

// ============================================================================
// APP RENDER
// ============================================================================

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// ============================================================================
// STARTUP LOGGING
// ============================================================================

if (
  process.env.NODE_ENV === 'development'
) {
  console.log(
    '🚀 TITech Community Capital Frontend Started'
  );

  console.log(
    'Environment:',
    process.env.NODE_ENV
  );

  console.log(
    'API URL:',
    process.env.REACT_APP_API_URL ||
      'http://localhost:5000'
  );
}