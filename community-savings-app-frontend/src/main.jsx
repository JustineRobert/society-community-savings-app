// frontend/src/main.jsx
// ============================================================================
// TITech Community Capital
// File: frontend/src/main.jsx
// Production Grade React 18 Entry Point
// ============================================================================

import React from "react";
import ReactDOM from "react-dom/client";

import Providers from "./app/providers";
import AppRoutes from "./routes/AppRoutes";

/*
|--------------------------------------------------------------------------
| Optional Global Styles
|--------------------------------------------------------------------------
*/

// import "./styles/index.css";
// import "./styles/tailwind.css";

/*
|--------------------------------------------------------------------------
| Development Console Noise Suppression
|--------------------------------------------------------------------------
|
| Some browser extensions, dev tooling, HMR clients,
| and WebSocket reconnect libraries emit noisy errors
| that are not actionable during development.
|
| We suppress only specific connection failures and
| restore console.error shortly after boot.
|
*/

const originalConsoleError = console.error;

if (import.meta.env.DEV) {
  console.error = (...args) => {
    try {
      const message = String(args?.[0] ?? "");

      const suppressibleErrors = [
        "WebSocket connection to",
        "Failed to fetch dynamically imported module",
        "ResizeObserver loop limit exceeded",
      ];

      const shouldSuppress =
        suppressibleErrors.some((error) =>
          message.includes(error)
        );

      if (shouldSuppress) {
        return;
      }
    } catch {
      // Ignore parsing failures
    }

    originalConsoleError(...args);
  };
}

/*
|--------------------------------------------------------------------------
| Root Element Validation
|--------------------------------------------------------------------------
*/

const container = document.getElementById("root");

if (!container) {
  throw new Error(
    "Root container '#root' was not found in index.html."
  );
}

/*
|--------------------------------------------------------------------------
| Create React Root
|--------------------------------------------------------------------------
*/

const root = ReactDOM.createRoot(container);

/*
|--------------------------------------------------------------------------
| Render Application
|--------------------------------------------------------------------------
*/

root.render(
  <React.StrictMode>
    <Providers>
      <AppRoutes />
    </Providers>
  </React.StrictMode>
);

/*
|--------------------------------------------------------------------------
| Restore Console
|--------------------------------------------------------------------------
*/

if (import.meta.env.DEV) {
  setTimeout(() => {
    console.error = originalConsoleError;
  }, 3000);
}

/*
|--------------------------------------------------------------------------
| Performance Monitoring
|--------------------------------------------------------------------------
|
| Optional integrations:
|
| reportWebVitals(console.log);
| reportWebVitals(sendToAnalytics);
|
*/

// import reportWebVitals from "./reportWebVitals";
// reportWebVitals();

/*
|--------------------------------------------------------------------------
| Application Diagnostics
|--------------------------------------------------------------------------
*/

if (import.meta.env.DEV) {
  window.__APP_INFO__ = {
    name: "TITech Community Capital",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0",
    environment:
      import.meta.env.MODE || "development",
    buildTime:
      import.meta.env.VITE_BUILD_TIME ||
      new Date().toISOString(),
  };
}

/*
|--------------------------------------------------------------------------
| Hot Module Replacement
|--------------------------------------------------------------------------
*/

if (import.meta.hot) {
  import.meta.hot.accept();
}

/*
|--------------------------------------------------------------------------
| Future Integrations
|--------------------------------------------------------------------------
|
| Sentry.init({...})
| Analytics.initialize(...)
| FeatureFlagProvider.bootstrap(...)
| ServiceWorker.register(...)
| WebSocketManager.connect(...)
|
*/