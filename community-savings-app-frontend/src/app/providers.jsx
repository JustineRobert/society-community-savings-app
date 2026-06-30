// ============================================================================
// TITech Community Capital
// Application Providers
// File: frontend/src/app/providers.jsx
// Production Grade
// ============================================================================

import React, {
  StrictMode,
  Suspense,
  useEffect,
  useState,
} from "react";

import PropTypes from "prop-types";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter } from "react-router-dom";

import {
  store,
  persistor,
} from "./store";

import { AuthProvider } from "../context/AuthContext";

import ErrorBoundary from "../components/ui/ErrorBoundary";
import LoadingScreen from "../components/ui/LoadingScreen";
import NotificationProvider from "../components/ui/NotificationProvider";

import socket, {
  connectSocket,
} from "../services/socket";

// ============================================================================
// Environment Flags
// ============================================================================

const ENABLE_SOCKET =
  import.meta.env.VITE_ENABLE_SOCKET !== "false";

const ENABLE_SERVICE_WORKER =
  import.meta.env.VITE_ENABLE_SW === "true";

const IS_DEV =
  import.meta.env.DEV;

// ============================================================================
// Bootstrap
// ============================================================================

function Bootstrap({ children }) {
  const [initialized, setInitialized] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeApplication() {
      try {
        // ============================================================
        // Socket Initialization
        // ============================================================

        const token =
          localStorage.getItem("token");

        if (
          ENABLE_SOCKET &&
          token
        ) {
          try {
            connectSocket();
          } catch (error) {
            console.error(
              "Socket initialization failed",
              error
            );
          }
        }

        // ============================================================
        // Service Worker
        // ============================================================

        if (
          ENABLE_SERVICE_WORKER &&
          "serviceWorker" in navigator
        ) {
          try {
            await navigator.serviceWorker.register(
              "/sw.js"
            );

            if (IS_DEV) {
              console.info(
                "Service Worker Registered"
              );
            }
          } catch (error) {
            console.error(
              "SW registration failed",
              error
            );
          }
        }

        // ============================================================
        // Initialize Feature Flags
        // ============================================================

        store.dispatch({
          type:
            "featureFlags/initializeFeatureFlags",
        });

        // ============================================================
        // Initialize Settings
        // ============================================================

        store.dispatch({
          type:
            "settings/initializeSettings",
        });

        // ============================================================
        // Initialize Audit Module
        // ============================================================

        store.dispatch({
          type:
            "audit/initializeAudit",
        });

        if (mounted) {
          setInitialized(true);
        }
      } catch (error) {
        console.error(
          "Application bootstrap failed",
          error
        );

        if (mounted) {
          setInitialized(true);
        }
      }
    }

    initializeApplication();

    return () => {
      mounted = false;

      try {
        socket.disconnect();
      } catch (_) {}
    };
  }, []);

  if (!initialized) {
    return (
      <LoadingScreen
        message="Initializing application..."
      />
    );
  }

  return children;
}

Bootstrap.propTypes = {
  children: PropTypes.node,
};

// ============================================================================
// Persist Loader
// ============================================================================

function PersistLoader() {
  return (
    <LoadingScreen
      message="Restoring session..."
    />
  );
}

// ============================================================================
// Global Error Handlers
// ============================================================================

function GlobalListeners() {
  useEffect(() => {
    function handleError(event) {
      console.error(
        "Global Error:",
        event.error
      );
    }

    function handleRejection(event) {
      console.error(
        "Unhandled Promise Rejection:",
        event.reason
      );
    }

    window.addEventListener(
      "error",
      handleError
    );

    window.addEventListener(
      "unhandledrejection",
      handleRejection
    );

    return () => {
      window.removeEventListener(
        "error",
        handleError
      );

      window.removeEventListener(
        "unhandledrejection",
        handleRejection
      );
    };
  }, []);

  return null;
}

// ============================================================================
// Application Providers
// ============================================================================

export default function Providers({
  children,
}) {
  return (
    <StrictMode>
      <ErrorBoundary>
        <Provider store={store}>
          <PersistGate
            persistor={persistor}
            loading={<PersistLoader />}
          >
            <BrowserRouter>
              <AuthProvider>
                <NotificationProvider>
                  <Bootstrap>
                    <GlobalListeners />

                    <Suspense
                      fallback={
                        <LoadingScreen
                          message="Loading..."
                        />
                      }
                    >
                      {children}
                    </Suspense>
                  </Bootstrap>
                </NotificationProvider>
              </AuthProvider>
            </BrowserRouter>
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );
}

Providers.propTypes = {
  children: PropTypes.node,
};