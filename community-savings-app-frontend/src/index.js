import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // ✅ FIX
import App from './App.jsx';

const originalConsoleError = console.error;
console.error = (...args) => {
  try {
    const first = String(args[0] || '');
    if (first.includes('WebSocket connection to') && first.includes('failed')) {
      return;
    }
  } catch (e) {}
  originalConsoleError.apply(console, args);
};

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter> {/* ✅ FIX */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

setTimeout(() => {
  console.error = originalConsoleError;
}, 3000);