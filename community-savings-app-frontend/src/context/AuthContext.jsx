// ============================================================================
// TITech Community Capital
// Enterprise Authentication Context
//
// File:
// frontend/src/context/AuthContext.jsx
//
// Production Grade
// Secure JWT | HttpOnly Refresh Cookie | Multi-Tenant
// Single-Flight Refresh | Socket | Session Bootstrap
// Offline Awareness | Cross-Tab Session Events
// React StrictMode Safe | Session Recovery | Defensive Cleanup
//
// IMPORTANT SECURITY MODEL
//
// Access Token:
//   - Memory only
//   - Never persisted to localStorage/sessionStorage
//
// Refresh Token:
//   - Managed exclusively by backend
//   - Expected in HttpOnly + Secure + SameSite cookie
//   - Never exposed to JavaScript
//
// Axios:
//   - Centralized in ../services/api
//   - Do NOT create another Axios instance here
//
// AUTHORITY MODEL
//
// Backend:
//   - Authoritative for authentication
//   - Authoritative for authorization
//   - Authoritative for tenant access
//
// Frontend:
//   - Maintains short-lived access-token state
//   - Schedules proactive refresh
//   - Hydrates current user
//   - Manages realtime connection lifecycle
//   - Provides UI/session state
// ============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import PropTypes from "prop-types";
import { toast } from "react-toastify";

import socket, {
  connectSocket,
} from "../services/socket";

import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  getToken,
  setToken,
  clearToken,
  getTenant,
  setTenant,
  clearTenant,
  isOnline,
  onNetworkStateChange,
  get as apiGet,
} from "../services/api";

// ============================================================================
// Configuration
// ============================================================================

const IS_DEV =
  Boolean(import.meta.env.DEV);

const TOKEN_REFRESH_BUFFER_SECONDS =
  120;

const AUTH_CHANNEL_NAME =
  "titech-auth";

const AUTH_ME_ENDPOINT =
  "/api/auth/me";

const REFRESH_RETRY_COOLDOWN_MS =
  5000;

// ============================================================================
// Context
// ============================================================================

const AuthContext =
  createContext(null);

// ============================================================================
// JWT Helpers
// ============================================================================
//
// These helpers are used ONLY for client-side refresh scheduling.
//
// They are NOT authorization mechanisms.
//
// Backend authorization remains authoritative.
// ============================================================================

function parseJwt(token) {
  try {
    if (
      typeof token !== "string" ||
      !token
    ) {
      return null;
    }

    const parts =
      token.split(".");

    if (
      parts.length !== 3
    ) {
      return null;
    }

    const base64 =
      parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padded =
      base64.padEnd(
        Math.ceil(
          base64.length / 4
        ) * 4,
        "="
      );

    const json =
      atob(padded);

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenExpiry(token) {
  const payload =
    parseJwt(token);

  if (
    !payload ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  return payload.exp * 1000;
}

function isTokenExpired(token) {
  const expiry =
    getTokenExpiry(token);

  if (!expiry) {
    return true;
  }

  return expiry <= Date.now();
}

function getRefreshDelay(token) {
  const expiry =
    getTokenExpiry(token);

  if (!expiry) {
    return null;
  }

  const refreshAt =
    expiry -
    TOKEN_REFRESH_BUFFER_SECONDS *
      1000;

  return Math.max(
    refreshAt -
      Date.now(),
    0
  );
}

// ============================================================================
// Response Helpers
// ============================================================================

function extractAccessToken(response) {
  return (
    response?.accessToken ||
    response?.data?.accessToken ||
    response?.data?.token ||
    response?.token ||
    null
  );
}

function normalizeUser(response) {
  if (!response) {
    return null;
  }

  return (
    response.data?.user ||
    response.data?.profile ||
    response.user ||
    response.profile ||
    response.data ||
    response
  );
}

function extractTenantId(
  response,
  profile
) {
  return (
    response?.data?.tenantId ||
    response?.tenantId ||
    profile?.tenantId ||
    profile?.tenant?.id ||
    profile?.tenant?._id ||
    null
  );
}

// ============================================================================
// Safe Development Logging
// ============================================================================

function devLog(
  level,
  message,
  metadata
) {
  if (!IS_DEV) {
    return;
  }

  try {
    const logger =
      console[level] ||
      console.info;

    if (metadata !== undefined) {
      logger(
        message,
        metadata
      );
    } else {
      logger(message);
    }
  } catch {
    // Logging must never affect authentication.
  }
}

// ============================================================================
// Auth Provider
// ============================================================================

export function AuthProvider({
  children,
}) {
  // ========================================================================
  // State
  // ========================================================================

  const [user, setUser] =
    useState(null);

  const [token, setTokenState] =
    useState(() =>
      getToken()
    );

  const [loading, setLoading] =
    useState(true);

  const [online, setOnline] =
    useState(() =>
      isOnline()
    );

  const [refreshing, setRefreshing] =
    useState(false);

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [authError, setAuthError] =
    useState(null);

  // ========================================================================
  // Refs
  // ========================================================================

  const mountedRef =
    useRef(false);

  const refreshTimerRef =
    useRef(null);

  const refreshPromiseRef =
    useRef(null);

  const logoutPromiseRef =
    useRef(null);

  const socketConnectedRef =
    useRef(false);

  const lastRefreshFailureRef =
    useRef(0);

  const bootstrapPromiseRef =
    useRef(null);

  const channelRef =
    useRef(null);

  // ========================================================================
  // Mounted State Helper
  // ========================================================================

  const isMounted =
    useCallback(
      () =>
        mountedRef.current,
      []
    );

  // ========================================================================
  // Token State
  // ========================================================================
  //
  // Centralized through services/api.js.
  //
  // No localStorage.
  // No sessionStorage.
  // ========================================================================

  const updateAccessToken =
    useCallback(
      accessToken => {
        if (
          !accessToken
        ) {
          clearToken();

          if (
            mountedRef.current
          ) {
            setTokenState(null);
          }

          return;
        }

        setToken(
          accessToken
        );

        if (
          mountedRef.current
        ) {
          setTokenState(
            accessToken
          );
        }
      },
      []
    );

  // ========================================================================
  // Tenant Synchronization
  // ========================================================================

  const synchronizeTenant =
    useCallback(
      (
        response,
        profile
      ) => {
        const tenantId =
          extractTenantId(
            response,
            profile
          );

        if (tenantId) {
          setTenant(
            tenantId
          );

          return tenantId;
        }

        return getTenant();
      },
      []
    );

  // ========================================================================
  // Refresh Timer
  // ========================================================================

  const clearRefreshTimer =
    useCallback(() => {
      if (
        refreshTimerRef.current !== null
      ) {
        clearTimeout(
          refreshTimerRef.current
        );

        refreshTimerRef.current =
          null;
      }
    }, []);

  // ========================================================================
  // Socket State
  // ========================================================================

  const setSocketConnectionState =
    useCallback(
      connected => {
        socketConnectedRef.current =
          Boolean(connected);

        if (
          mountedRef.current
        ) {
          setSocketConnected(
            Boolean(connected)
          );
        }
      },
      []
    );

  // ========================================================================
  // Socket Connection
  // ========================================================================

  const connectUserSocket =
    useCallback(() => {
      const currentToken =
        getToken();

      if (
        !currentToken ||
        isTokenExpired(
          currentToken
        )
      ) {
        setSocketConnectionState(
          false
        );

        return false;
      }

      if (
        socketConnectedRef.current
      ) {
        return true;
      }

      try {
        connectSocket();

        setSocketConnectionState(
          true
        );

        devLog(
          "info",
          "[AUTH] Socket connection requested"
        );

        return true;
      } catch (error) {
        setSocketConnectionState(
          false
        );

        devLog(
          "error",
          "[AUTH] Socket connection failed",
          error
        );

        return false;
      }
    }, [
      setSocketConnectionState,
    ]);

  // ========================================================================
  // Socket Disconnection
  // ========================================================================

  const disconnectUserSocket =
    useCallback(() => {
      try {
        if (
          socket &&
          typeof socket.disconnect ===
            "function"
        ) {
          socket.disconnect();
        }
      } catch (error) {
        devLog(
          "warn",
          "[AUTH] Socket disconnect failed",
          error
        );
      } finally {
        setSocketConnectionState(
          false
        );
      }
    }, [
      setSocketConnectionState,
    ]);

  // ========================================================================
  // User Session Hydration
  // ========================================================================

  const hydrateUser =
    useCallback(
      async () => {
        const currentToken =
          getToken();

        if (
          !currentToken ||
          isTokenExpired(
            currentToken
          )
        ) {
          return null;
        }

        const response =
          await apiGet(
            AUTH_ME_ENDPOINT
          );

        const profile =
          normalizeUser(
            response
          );

        if (
          profile &&
          mountedRef.current
        ) {
          setUser(
            profile
          );
        }

        synchronizeTenant(
          response,
          profile
        );

        return profile;
      },
      [
        synchronizeTenant,
      ]
    );

  // ========================================================================
  // Proactive Refresh Scheduling
  // ========================================================================

  const scheduleRefresh =
    useCallback(
      accessToken => {
        clearRefreshTimer();

        if (
          !accessToken
        ) {
          return;
        }

        const delay =
          getRefreshDelay(
            accessToken
          );

        if (
          delay === null
        ) {
          return;
        }

        refreshTimerRef.current =
          setTimeout(
            () => {
              refreshSession({
                reason:
                  "scheduled",
              }).catch(
                error => {
                  devLog(
                    "warn",
                    "[AUTH] Scheduled refresh failed",
                    error
                  );
                }
              );
            },
            delay
          );
      },
      [
        clearRefreshTimer,
      ]
    );

  // ========================================================================
  // Refresh Session
  // ========================================================================
  //
  // Context-level single-flight protection.
  //
  // api.js may also implement single-flight refresh. This second boundary
  // protects against concurrent callers originating specifically from the
  // authentication context, such as:
  //
  //   - refresh timer
  //   - network recovery
  //   - bootstrap
  //   - manual refresh
  //
  // The refresh token remains HttpOnly and is never accessed here.
  // ========================================================================

  const refreshSession =
    useCallback(
      async ({
        reason = "manual",
        suppressErrorState = false,
      } = {}) => {
        if (
          refreshPromiseRef.current
        ) {
          return refreshPromiseRef.current;
        }

        const now =
          Date.now();

        if (
          now -
            lastRefreshFailureRef.current <
          REFRESH_RETRY_COOLDOWN_MS
        ) {
          throw new Error(
            "Authentication refresh is temporarily rate limited."
          );
        }

        const refreshOperation =
          (async () => {
            if (
              mountedRef.current
            ) {
              setRefreshing(
                true
              );
            }

            try {
              const response =
                await apiRefreshToken();

              const newToken =
                extractAccessToken(
                  response
                );

              if (
                !newToken
              ) {
                throw new Error(
                  "Refresh succeeded but no access token was returned."
                );
              }

              updateAccessToken(
                newToken
              );

              scheduleRefresh(
                newToken
              );

              if (
                mountedRef.current
              ) {
                setAuthError(
                  null
                );
              }

              devLog(
                "info",
                "[AUTH] Session refreshed",
                {
                  reason,
                }
              );

              return newToken;
            } catch (error) {
              lastRefreshFailureRef.current =
                Date.now();

              clearRefreshTimer();

              updateAccessToken(
                null
              );

              if (
                !suppressErrorState &&
                mountedRef.current
              ) {
                setAuthError(
                  error
                );
              }

              throw error;
            } finally {
              if (
                mountedRef.current
              ) {
                setRefreshing(
                  false
                );
              }
            }
          })();

        refreshPromiseRef.current =
          refreshOperation;

        try {
          return await refreshOperation;
        } finally {
          if (
            refreshPromiseRef.current ===
            refreshOperation
          ) {
            refreshPromiseRef.current =
              null;
          }
        }
      },
      [
        clearRefreshTimer,
        scheduleRefresh,
        updateAccessToken,
      ]
    );

  // ========================================================================
  // Login
  // ========================================================================

  const login =
    useCallback(
      async (
        email,
        password,
        deviceInfo = {},
        options = {}
      ) => {
        if (
          typeof email !== "string" ||
          !email.trim()
        ) {
          throw new Error(
            "Email is required."
          );
        }

        if (
          typeof password !== "string" ||
          !password
        ) {
          throw new Error(
            "Password is required."
          );
        }

        setAuthError(
          null
        );

        const response =
          await apiLogin({
            email:
              email.trim(),
            password,
            deviceInfo,
            ...options,
          });

        const accessToken =
          extractAccessToken(
            response
          );

        if (
          !accessToken
        ) {
          throw new Error(
            "Login succeeded but no access token was returned."
          );
        }

        const profile =
          normalizeUser(
            response
          );

        updateAccessToken(
          accessToken
        );

        if (
          mountedRef.current
        ) {
          setUser(
            profile
          );
        }

        synchronizeTenant(
          response,
          profile
        );

        scheduleRefresh(
          accessToken
        );

        connectUserSocket();

        if (
          mountedRef.current
        ) {
          setAuthError(
            null
          );
        }

        toast.success(
          "Login successful"
        );

        devLog(
          "info",
          "[AUTH] Login successful"
        );

        return profile;
      },
      [
        connectUserSocket,
        scheduleRefresh,
        synchronizeTenant,
        updateAccessToken,
      ]
    );

  // ========================================================================
  // Register
  // ========================================================================

  const register =
    useCallback(
      async (
        payloadOrEmail,
        password,
        name,
        options = {}
      ) => {
        const payload =
          typeof payloadOrEmail ===
            "object" &&
          payloadOrEmail !== null &&
          !Array.isArray(
            payloadOrEmail
          )
            ? payloadOrEmail
            : {
                email:
                  payloadOrEmail,
                password,
                name,
              };

        const response =
          await apiRegister(
            payload,
            options
          );

        const accessToken =
          extractAccessToken(
            response
          );

        if (
          !accessToken
        ) {
          throw new Error(
            "Registration succeeded but no access token was returned."
          );
        }

        const profile =
          normalizeUser(
            response
          );

        updateAccessToken(
          accessToken
        );

        if (
          mountedRef.current
        ) {
          setUser(
            profile
          );
        }

        synchronizeTenant(
          response,
          profile
        );

        scheduleRefresh(
          accessToken
        );

        connectUserSocket();

        if (
          mountedRef.current
        ) {
          setAuthError(
            null
          );
        }

        toast.success(
          "Registration successful"
        );

        devLog(
          "info",
          "[AUTH] Registration successful"
        );

        return profile;
      },
      [
        connectUserSocket,
        scheduleRefresh,
        synchronizeTenant,
        updateAccessToken,
      ]
    );

  // ========================================================================
  // Cross-Tab Broadcast
  // ========================================================================

  const broadcastAuthEvent =
    useCallback(
      type => {
        try {
          if (
            typeof BroadcastChannel ===
            "undefined"
          ) {
            return;
          }

          const channel =
            new BroadcastChannel(
              AUTH_CHANNEL_NAME
            );

          channel.postMessage({
            type,
            timestamp:
              Date.now(),
          });

          channel.close();
        } catch (error) {
          devLog(
            "warn",
            "[AUTH] BroadcastChannel event failed",
            error
          );
        }
      },
      []
    );

  // ========================================================================
  // Logout
  // ========================================================================

  const performLogout =
    useCallback(
      async (
        silent = false,
        notifyUser = true
      ) => {
        if (
          logoutPromiseRef.current
        ) {
          return logoutPromiseRef.current;
        }

        const operation =
          (async () => {
            try {
              // ------------------------------------------------------------
              // Backend logout.
              //
              // Failure is intentionally non-fatal. Local authentication
              // state must still be destroyed.
              // ------------------------------------------------------------

              try {
                await apiLogout();
              } catch (error) {
                devLog(
                  "warn",
                  "[AUTH] Logout API failed; continuing local cleanup",
                  error
                );
              }

              // ------------------------------------------------------------
              // Cancel scheduled refresh.
              // ------------------------------------------------------------

              clearRefreshTimer();

              // ------------------------------------------------------------
              // Cancel any pending refresh reference.
              //
              // The underlying HTTP request may still complete, but the
              // resulting token cannot be accepted after local logout.
              // ------------------------------------------------------------

              refreshPromiseRef.current =
                null;

              // ------------------------------------------------------------
              // Disconnect realtime session.
              // ------------------------------------------------------------

              disconnectUserSocket();

              // ------------------------------------------------------------
              // Clear authentication.
              // ------------------------------------------------------------

              updateAccessToken(
                null
              );

              if (
                mountedRef.current
              ) {
                setUser(
                  null
                );

                setAuthError(
                  null
                );
              }

              clearTenant();

              // ------------------------------------------------------------
              // Notify other browser contexts.
              //
              // No token or sensitive session data is transmitted.
              // ------------------------------------------------------------

              broadcastAuthEvent(
                "AUTH_LOGOUT"
              );

              if (
                notifyUser &&
                !silent &&
                mountedRef.current
              ) {
                toast.info(
                  "Logged out successfully"
                );
              }

              devLog(
                "info",
                "[AUTH] Logout completed"
              );
            } finally {
              logoutPromiseRef.current =
                null;
            }
          })();

        logoutPromiseRef.current =
          operation;

        return operation;
      },
      [
        broadcastAuthEvent,
        clearRefreshTimer,
        disconnectUserSocket,
        updateAccessToken,
      ]
    );

  // ========================================================================
  // Public Logout
  // ========================================================================

  const logout =
    useCallback(
      async silent => {
        await performLogout(
          Boolean(silent),
          true
        );
      },
      [
        performLogout,
      ]
    );

  // ========================================================================
  // Session Bootstrap
  // ========================================================================
  //
  // StrictMode-safe:
  //
  // No permanent "initialized" flag is used. React may mount/unmount/re-run
  // effects during development without permanently preventing authentication
  // initialization.
  // ========================================================================

  const initializeAuthentication =
    useCallback(
      async signal => {
        if (
          bootstrapPromiseRef.current
        ) {
          return bootstrapPromiseRef.current;
        }

        const operation =
          (async () => {
            try {
              setAuthError(
                null
              );

              let currentToken =
                getToken();

              // ============================================================
              // Existing in-memory access token.
              // ============================================================

              if (
                currentToken &&
                !isTokenExpired(
                  currentToken
                )
              ) {
                try {
                  const profile =
                    await hydrateUser();

                  if (
                    signal.cancelled ||
                    !mountedRef.current
                  ) {
                    return;
                  }

                  setUser(
                    profile
                  );

                  scheduleRefresh(
                    currentToken
                  );

                  connectUserSocket();

                  return;
                } catch (error) {
                  devLog(
                    "warn",
                    "[AUTH] Existing access token could not hydrate session",
                    error
                  );

                  updateAccessToken(
                    null
                  );
                }
              }

              // ============================================================
              // Restore session from HttpOnly refresh cookie.
              // ============================================================

              currentToken =
                await refreshSession({
                  reason:
                    "bootstrap",
                  suppressErrorState:
                    true,
                });

              if (
                signal.cancelled ||
                !mountedRef.current
              ) {
                return;
              }

              const profile =
                await hydrateUser();

              if (
                signal.cancelled ||
                !mountedRef.current
              ) {
                return;
              }

              setUser(
                profile
              );

              scheduleRefresh(
                currentToken
              );

              connectUserSocket();
            } catch (error) {
              if (
                signal.cancelled
              ) {
                return;
              }

              devLog(
                "info",
                "[AUTH] No active authenticated session"
              );

              updateAccessToken(
                null
              );

              if (
                mountedRef.current
              ) {
                setUser(
                  null
                );

                setAuthError(
                  null
                );
              }

              disconnectUserSocket();
            }
          })();

        bootstrapPromiseRef.current =
          operation;

        try {
          await operation;
        } finally {
          if (
            bootstrapPromiseRef.current ===
            operation
          ) {
            bootstrapPromiseRef.current =
              null;
          }
        }
      },
      [
        connectUserSocket,
        disconnectUserSocket,
        hydrateUser,
        refreshSession,
        scheduleRefresh,
        updateAccessToken,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    const controller = {
      cancelled: false,
    };

    setLoading(
      true
    );

    initializeAuthentication(
      controller
    ).finally(() => {
      if (
        !controller.cancelled &&
        mountedRef.current
      ) {
        setLoading(
          false
        );
      }
    });

    return () => {
      controller.cancelled =
        true;

      mountedRef.current =
        false;

      clearRefreshTimer();

      disconnectUserSocket();
    };
  }, [
    clearRefreshTimer,
    disconnectUserSocket,
    initializeAuthentication,
  ]);

  // ========================================================================
  // Network State
  // ========================================================================

  useEffect(() => {
    const unsubscribe =
      onNetworkStateChange(
        ({ online: nextOnline }) => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          setOnline(
            nextOnline
          );

          devLog(
            "info",
            "[AUTH] Network state changed",
            {
              online:
                nextOnline,
            }
          );

          // --------------------------------------------------------------
          // Offline.
          //
          // Do not destroy authentication merely because connectivity is
          // temporarily unavailable.
          // --------------------------------------------------------------

          if (
            !nextOnline
          ) {
            return;
          }

          // --------------------------------------------------------------
          // Connectivity restored.
          //
          // Only attempt recovery when the application currently has no
          // authenticated user and initialization has completed.
          // --------------------------------------------------------------

          if (
            user ||
            loading ||
            refreshPromiseRef.current
          ) {
            return;
          }

          refreshSession({
            reason:
              "network-recovery",
            suppressErrorState:
              true,
          })
            .then(
              async newToken => {
                if (
                  !mountedRef.current
                ) {
                  return;
                }

                const profile =
                  await hydrateUser();

                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setUser(
                  profile
                );

                scheduleRefresh(
                  newToken
                );

                connectUserSocket();
              }
            )
            .catch(
              () => {
                // No active authenticated session is acceptable.
              }
            );
        }
      );

    return () => {
      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }
    };
  }, [
    connectUserSocket,
    hydrateUser,
    loading,
    refreshSession,
    scheduleRefresh,
    user,
  ]);

  // ========================================================================
  // Cross-Tab Authentication Events
  // ========================================================================

  useEffect(() => {
    if (
      typeof BroadcastChannel ===
      "undefined"
    ) {
      return undefined;
    }

    let channel;

    try {
      channel =
        new BroadcastChannel(
          AUTH_CHANNEL_NAME
        );

      channelRef.current =
        channel;
    } catch (error) {
      devLog(
        "warn",
        "[AUTH] Unable to create BroadcastChannel",
        error
      );

      return undefined;
    }

    const handleMessage =
      event => {
        const type =
          event.data?.type;

        if (
          type !==
          "AUTH_LOGOUT"
        ) {
          return;
        }

        devLog(
          "info",
          "[AUTH] Received cross-tab logout event"
        );

        clearRefreshTimer();

        disconnectUserSocket();

        updateAccessToken(
          null
        );

        if (
          mountedRef.current
        ) {
          setUser(
            null
          );

          setAuthError(
            null
          );
        }

        clearTenant();
      };

    channel.addEventListener(
      "message",
      handleMessage
    );

    return () => {
      channel.removeEventListener(
        "message",
        handleMessage
      );

      try {
        channel.close();
      } catch {
        // Ignore channel cleanup failures.
      }

      if (
        channelRef.current ===
        channel
      ) {
        channelRef.current =
          null;
      }
    };
  }, [
    clearRefreshTimer,
    disconnectUserSocket,
    updateAccessToken,
  ]);

  // ========================================================================
  // Token Synchronization
  // ========================================================================
  //
  // api.js remains authoritative for the actual HTTP token.
  //
  // This effect allows AuthContext to observe an in-memory token replacement
  // performed by the API client.
  // ========================================================================

  useEffect(() => {
    const currentToken =
      getToken();

    if (
      currentToken &&
      currentToken !== token
    ) {
      setTokenState(
        currentToken
      );

      scheduleRefresh(
        currentToken
      );

      return;
    }

    if (
      !currentToken &&
      token
    ) {
      setTokenState(
        null
      );

      clearRefreshTimer();

      if (
        mountedRef.current
      ) {
        setUser(
          null
        );
      }

      disconnectUserSocket();
    }
  }, [
    clearRefreshTimer,
    disconnectUserSocket,
    scheduleRefresh,
    token,
  ]);

  // ========================================================================
  // Context Value
  // ========================================================================

  const value =
    useMemo(
      () => {
        const tenantId =
          getTenant();

        const authenticated =
          Boolean(
            user &&
            token &&
            !isTokenExpired(
              token
            )
          );

        return {
          // ------------------------------------------------------------
          // Identity
          // ------------------------------------------------------------

          user,

          token,

          authenticated,

          loading,

          online,

          // ------------------------------------------------------------
          // Session state
          // ------------------------------------------------------------

          refreshing,

          authError,

          authReady:
            !loading,

          sessionActive:
            authenticated,

          // ------------------------------------------------------------
          // Authentication
          // ------------------------------------------------------------

          login,

          register,

          logout,

          refreshToken:
            refreshSession,

          // ------------------------------------------------------------
          // Tenant
          // ------------------------------------------------------------

          tenantId,

          // ------------------------------------------------------------
          // Socket
          // ------------------------------------------------------------

          socketConnected,

          connectSocket:
            connectUserSocket,

          disconnectSocket:
            disconnectUserSocket,

          // ------------------------------------------------------------
          // Token utilities
          // ------------------------------------------------------------

          getAccessToken:
            getToken,
        };
      },
      [
        user,
        token,
        loading,
        online,
        refreshing,
        authError,
        login,
        register,
        logout,
        refreshSession,
        socketConnected,
        connectUserSocket,
        disconnectUserSocket,
      ]
    );

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <AuthContext.Provider
      value={value}
    >
      {!loading &&
        children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// PropTypes
// ============================================================================

AuthProvider.propTypes = {
  children:
    PropTypes.node.isRequired,
};

// ============================================================================
// Hook
// ============================================================================

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider. " +
        "Ensure the component is rendered inside <AuthProvider>."
    );
  }

  return context;
}

// ============================================================================
// Export
// ============================================================================

export default AuthContext;