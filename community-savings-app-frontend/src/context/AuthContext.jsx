// ============================================================================
// TITech Community Capital
// Enterprise Auth Context
//
// File:
// frontend/src/context/AuthContext.jsx
//
// Production Grade
// Secure JWT | HttpOnly Refresh Cookie | Multi-Tenant
// Single-Flight Refresh | Socket | Session Bootstrap
// Offline Awareness | Cross-Tab Session Events
//
// IMPORTANT SECURITY MODEL
//
// Access Token:
//   - Memory only
//   - Never persisted to localStorage/sessionStorage
//
// Refresh Token:
//   - Managed by backend
//   - Expected in HttpOnly + Secure + SameSite cookie
//   - Never exposed to JavaScript
//
// Axios:
//   - Centralized in ../services/api
//   - Do NOT create another Axios instance here
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
  bootstrapAuthentication,
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
  import.meta.env.DEV;

const TOKEN_REFRESH_BUFFER_SECONDS =
  120;

// ============================================================================
// Context
// ============================================================================

const AuthContext =
  createContext(null);

// ============================================================================
// JWT Helpers
// ============================================================================
//
// These helpers are only used to determine when a short-lived access token
// should be refreshed.
//
// They are NOT used for authorization decisions.
//
// The backend remains authoritative.
// ============================================================================

function parseJwt(token) {
  try {
    if (!token) {
      return null;
    }

    const parts =
      token.split(".");

    if (parts.length !== 3) {
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

function getTokenExpiry(
  token
) {
  const payload =
    parseJwt(token);

  if (
    !payload?.exp
  ) {
    return null;
  }

  return payload.exp * 1000;
}

function isTokenExpired(
  token
) {
  const expiry =
    getTokenExpiry(token);

  if (!expiry) {
    return true;
  }

  return (
    expiry <= Date.now()
  );
}

function getRefreshDelay(
  token
) {
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
// Profile Normalization
// ============================================================================

function normalizeUser(
  response
) {
  if (!response) {
    return null;
  }

  return (
    response.data?.user ||
    response.data?.profile ||
    response.data ||
    response
  );
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

  // ========================================================================
  // Refs
  // ========================================================================

  const mountedRef =
    useRef(false);

  const initializedRef =
    useRef(false);

  const refreshTimerRef =
    useRef(null);

  const logoutInProgressRef =
    useRef(false);

  const socketConnectedRef =
    useRef(false);

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
        if (!accessToken) {
          clearToken();

          setTokenState(null);

          return;
        }

        setToken(
          accessToken
        );

        setTokenState(
          accessToken
        );
      },
      []
    );

  // ========================================================================
  // Refresh Timer
  // ========================================================================

  const clearRefreshTimer =
    useCallback(() => {
      if (
        refreshTimerRef.current
      ) {
        clearTimeout(
          refreshTimerRef.current
        );

        refreshTimerRef.current =
          null;
      }
    }, []);

  // ========================================================================
  // Schedule Access Token Refresh
  // ========================================================================

  const scheduleRefresh =
    useCallback(
      accessToken => {
        clearRefreshTimer();

        if (!accessToken) {
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
            async () => {
              try {
                await refreshSession();
              } catch (
                error
              ) {
                if (
                  IS_DEV
                ) {
                  console.warn(
                    "[AUTH] Scheduled refresh failed",
                    error
                  );
                }

                await performLogout(
                  true,
                  false
                );
              }
            },
            delay
          );
      },
      [clearRefreshTimer]
    );

  // ========================================================================
  // Socket
  // ========================================================================

  const connectUserSocket =
    useCallback(() => {
      if (
        !getToken()
      ) {
        return false;
      }

      try {
        connectSocket();

        socketConnectedRef.current =
          true;

        if (IS_DEV) {
          console.info(
            "[AUTH] Socket connected"
          );
        }

        return true;
      } catch (
        error
      ) {
        socketConnectedRef.current =
          false;

        console.error(
          "[AUTH] Socket connection failed",
          error
        );

        return false;
      }
    }, []);

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
      } catch (
        error
      ) {
        if (IS_DEV) {
          console.warn(
            "[AUTH] Socket disconnect failed",
            error
          );
        }
      }

      socketConnectedRef.current =
        false;
    }, []);

  // ========================================================================
  // User Session Hydration
  // ========================================================================

  const hydrateUser =
    useCallback(
      async () => {
        const currentToken =
          getToken();

        if (
          !currentToken
        ) {
          return null;
        }

        const response =
          await apiGet(
            "/api/auth/me"
          );

        const profile =
          normalizeUser(
            response
          );

        if (
          profile
        ) {
          setUser(
            profile
          );
        }

        // If backend supplies tenant information, synchronize the client
        // context. Backend authorization remains authoritative.
        const tenantId =
          response.data
            ?.tenantId ||
          profile?.tenantId ||
          profile?.tenant?.id;

        if (
          tenantId
        ) {
          setTenant(
            tenantId
          );
        }

        return profile;
      },
      []
    );

  // ========================================================================
  // Refresh Session
  // ========================================================================
  //
  // api.js already implements single-flight refresh.
  //
  // This context intentionally does NOT implement another refresh queue.
  // ========================================================================

  const refreshSession =
    useCallback(
      async () => {
        try {
          const response =
            await apiRefreshToken();

          const newToken =
            response?.accessToken ||
            response?.data?.accessToken ||
            response?.data?.token;

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

          return newToken;
        } catch (
          error
        ) {
          clearRefreshTimer();

          updateAccessToken(
            null
          );

          throw error;
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
          !email ||
          !password
        ) {
          throw new Error(
            "Email and password are required."
          );
        }

        const response =
          await apiLogin({
            email,
            password,
            deviceInfo,
            ...options,
          });

        const accessToken =
          response?.data
            ?.accessToken ||
          response?.data
            ?.token;

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
          profile
        ) {
          setUser(
            profile
          );
        }

        const tenantId =
          response.data
            ?.tenantId ||
          profile?.tenantId ||
          profile?.tenant?.id;

        if (
          tenantId
        ) {
          setTenant(
            tenantId
          );
        }

        scheduleRefresh(
          accessToken
        );

        connectUserSocket();

        toast.success(
          "Login successful"
        );

        return profile;
      },
      [
        connectUserSocket,
        scheduleRefresh,
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
          response?.data
            ?.accessToken ||
          response?.data
            ?.token;

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
          profile
        ) {
          setUser(
            profile
          );
        }

        const tenantId =
          response.data
            ?.tenantId ||
          profile?.tenantId ||
          profile?.tenant?.id;

        if (
          tenantId
        ) {
          setTenant(
            tenantId
          );
        }

        scheduleRefresh(
          accessToken
        );

        connectUserSocket();

        toast.success(
          "Registration successful"
        );

        return profile;
      },
      [
        connectUserSocket,
        scheduleRefresh,
        updateAccessToken,
      ]
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
          logoutInProgressRef.current
        ) {
          return;
        }

        logoutInProgressRef.current =
          true;

        try {
          // --------------------------------------------------------------
          // Tell backend to invalidate/rotate session.
          //
          // Failure is intentionally non-fatal because local security state
          // must still be cleared.
          // --------------------------------------------------------------

          try {
            await apiLogout();
          } catch (
            error
          ) {
            if (
              IS_DEV
            ) {
              console.warn(
                "[AUTH] Logout API failed; clearing local state",
                error
              );
            }
          }

          // --------------------------------------------------------------
          // Clear timers
          // --------------------------------------------------------------

          clearRefreshTimer();

          // --------------------------------------------------------------
          // Disconnect realtime session
          // --------------------------------------------------------------

          disconnectUserSocket();

          // --------------------------------------------------------------
          // Clear authentication
          // --------------------------------------------------------------

          updateAccessToken(
            null
          );

          setUser(
            null
          );

          clearTenant();

          // --------------------------------------------------------------
          // Notify other tabs/windows.
          //
          // This event does not contain a token.
          // --------------------------------------------------------------

          try {
            if (
              typeof BroadcastChannel !==
              "undefined"
            ) {
              const channel =
                new BroadcastChannel(
                  "titech-auth"
                );

              channel.postMessage({
                type:
                  "AUTH_LOGOUT",
              });

              channel.close();
            }
          } catch {
            // BroadcastChannel unavailable.
          }

          if (
            notifyUser &&
            !silent
          ) {
            toast.info(
              "Logged out successfully"
            );
          }
        } finally {
          logoutInProgressRef.current =
            false;
        }
      },
      [
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
      [performLogout]
    );

  // ========================================================================
  // Initial Authentication Bootstrap
  // ========================================================================
  //
  // This supports both:
  //
  // 1. Existing in-memory access token.
  //
  // 2. Page reload where only the HttpOnly refresh cookie remains.
  //
  // The backend refresh endpoint restores the access token.
  // ========================================================================

  useEffect(() => {
    if (
      initializedRef.current
    ) {
      return;
    }

    initializedRef.current =
      true;

    mountedRef.current =
      true;

    let cancelled = false;

    async function initializeAuth() {
      try {
        // ==============================================================
        // Existing access token
        // ==============================================================

        let currentToken =
          getToken();

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
              cancelled ||
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
          } catch (
            error
          ) {
            if (
              IS_DEV
            ) {
              console.warn(
                "[AUTH] Existing access token could not hydrate session",
                error
              );
            }

            updateAccessToken(
              null
            );
          }
        }

        // ==============================================================
        // Refresh from HttpOnly cookie
        // ==============================================================

        try {
          currentToken =
            await refreshSession();

          if (
            cancelled ||
            !mountedRef.current
          ) {
            return;
          }

          const profile =
            await hydrateUser();

          if (
            cancelled ||
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
        } catch (
          error
        ) {
          if (
            IS_DEV
          ) {
            console.info(
              "[AUTH] No active authenticated session",
              error
            );
          }

          updateAccessToken(
            null
          );

          setUser(
            null
          );
        }
      } finally {
        if (
          !cancelled &&
          mountedRef.current
        ) {
          setLoading(
            false
          );
        }
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;

      mountedRef.current =
        false;

      clearRefreshTimer();
    };
  }, [
    clearRefreshTimer,
    connectUserSocket,
    hydrateUser,
    refreshSession,
    scheduleRefresh,
    updateAccessToken,
  ]);

  // ========================================================================
  // Network State
  // ========================================================================

  useEffect(() => {
    const unsubscribe =
      onNetworkStateChange(
        ({ online: nextOnline }) => {
          setOnline(
            nextOnline
          );

          if (
            IS_DEV
          ) {
            console.info(
              "[AUTH] Network state changed",
              {
                online:
                  nextOnline,
              }
            );
          }

          // When connectivity returns, try to restore the session if the
          // application currently has no authenticated user.
          if (
            nextOnline &&
            !user &&
            !loading
          ) {
            refreshSession()
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
                  // No active session is acceptable.
                }
              );
          }
        }
      );

    return unsubscribe;
  }, [
    connectUserSocket,
    hydrateUser,
    loading,
    refreshSession,
    scheduleRefresh,
    user,
  ]);

  // ========================================================================
  // Cross-Tab Authentication
  // ========================================================================
  //
  // Access tokens are NOT persisted, so localStorage cannot be used as the
  // source of authentication state.
  //
  // BroadcastChannel is used for logout/session events instead.
  // ========================================================================

  useEffect(() => {
    if (
      typeof BroadcastChannel ===
      "undefined"
    ) {
      return undefined;
    }

    const channel =
      new BroadcastChannel(
        "titech-auth"
      );

    const handleMessage =
      event => {
        if (
          event.data?.type ===
          "AUTH_LOGOUT"
        ) {
          clearRefreshTimer();

          disconnectUserSocket();

          updateAccessToken(
            null
          );

          setUser(
            null
          );

          clearTenant();
        }
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

      channel.close();
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
  // If api.js refreshes the token independently after a 401, AuthContext
  // should notice the new in-memory token on the next render/use.
  //
  // The API client remains authoritative for HTTP authentication.
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
    }

    if (
      !currentToken &&
      token
    ) {
      setTokenState(
        null
      );

      setUser(
        null
      );
    }
  }, [
    token,
    scheduleRefresh,
  ]);

  // ========================================================================
  // Context Value
  // ========================================================================

  const value =
    useMemo(
      () => ({
        // ------------------------------------------------------------
        // Identity
        // ------------------------------------------------------------

        user,

        token,

        authenticated:
          Boolean(
            user &&
              token
          ),

        loading,

        online,

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

        tenantId:
          getTenant(),

        // ------------------------------------------------------------
        // Socket
        // ------------------------------------------------------------

        socketConnected:
          socketConnectedRef.current,

        // ------------------------------------------------------------
        // Session controls
        // ------------------------------------------------------------

        connectSocket:
          connectUserSocket,

        disconnectSocket:
          disconnectUserSocket,

        // ------------------------------------------------------------
        // Token utilities
        // ------------------------------------------------------------

        getAccessToken:
          getToken,
      }),
      [
        user,
        token,
        loading,
        online,
        login,
        register,
        logout,
        refreshSession,
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
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
}

// ============================================================================
// Export
// ============================================================================

export default AuthContext;