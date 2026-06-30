// ============================================================================
// TITech Community Capital
// Enterprise Authentication Slice
// File: frontend/src/features/auth/authSlice.js
// Production Grade
// ============================================================================

import { createSlice, createSelector } from "@reduxjs/toolkit";

// ============================================================================
// Helpers
// ============================================================================

const STORAGE_KEYS = {
  TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER: "user",
  TENANT: "tenantId",
};

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    if (
      value === undefined ||
      value === null
    ) {
      localStorage.removeItem(key);
      return;
    }

    if (typeof value === "object") {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
      return;
    }

    localStorage.setItem(
      key,
      value
    );
  } catch (err) {
    console.error(
      "Storage write error:",
      err
    );
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function parseUser() {
  try {
    const user =
      safeStorageGet(
        STORAGE_KEYS.USER
      );

    return user
      ? JSON.parse(user)
      : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  user: parseUser(),

  token:
    safeStorageGet(
      STORAGE_KEYS.TOKEN
    ),

  refreshToken:
    safeStorageGet(
      STORAGE_KEYS
        .REFRESH_TOKEN
    ),

  tenantId:
    safeStorageGet(
      STORAGE_KEYS.TENANT
    ),

  authenticated:
    !!safeStorageGet(
      STORAGE_KEYS.TOKEN
    ),

  loading: false,

  initialized: false,

  sessionExpired: false,

  permissions: [],

  roles: [],

  features: [],

  loginMethod: null,

  lastLoginAt: null,

  lastActivityAt:
    Date.now(),

  error: null,
};

// ============================================================================
// Slice
// ============================================================================

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    // =======================================================================
    // Initialize Session
    // =======================================================================

    initializeAuth(
      state
    ) {
      state.initialized = true;
      state.authenticated =
        !!state.token;
    },

    // =======================================================================
    // Loading
    // =======================================================================

    setAuthLoading(
      state,
      action
    ) {
      state.loading =
        action.payload;
    },

    // =======================================================================
    // Login Start
    // =======================================================================

    loginStart(state) {
      state.loading = true;
      state.error = null;
      state.sessionExpired =
        false;
    },

    // =======================================================================
    // Login Success
    // =======================================================================

    loginSuccess(
      state,
      action
    ) {
      const {
        user,
        token,
        refreshToken,
        tenantId,
        loginMethod,
      } = action.payload;

      state.loading = false;
      state.user = user;
      state.token = token;
      state.refreshToken =
        refreshToken || null;
      state.authenticated =
        true;
      state.initialized = true;
      state.error = null;
      state.loginMethod =
        loginMethod || "jwt";
      state.lastLoginAt =
        new Date().toISOString();
      state.lastActivityAt =
        Date.now();
      state.sessionExpired =
        false;

      state.tenantId =
        tenantId ||
        user?.tenantId ||
        null;

      state.permissions =
        user?.permissions ||
        [];

      state.roles =
        user?.roles ||
        (user?.role
          ? [user.role]
          : []);

      state.features =
        user?.features ||
        [];

      safeStorageSet(
        STORAGE_KEYS.TOKEN,
        token
      );

      safeStorageSet(
        STORAGE_KEYS
          .REFRESH_TOKEN,
        refreshToken
      );

      safeStorageSet(
        STORAGE_KEYS.USER,
        user
      );

      safeStorageSet(
        STORAGE_KEYS.TENANT,
        state.tenantId
      );
    },

    // =======================================================================
    // Login Failure
    // =======================================================================

    loginFailure(
      state,
      action
    ) {
      state.loading = false;

      state.error =
        action.payload ||
        "Authentication failed";

      state.authenticated =
        false;
    },

    // =======================================================================
    // Refresh Token
    // =======================================================================

    refreshTokenSuccess(
      state,
      action
    ) {
      state.token =
        action.payload.token;

      state.lastActivityAt =
        Date.now();

      state.authenticated =
        true;

      safeStorageSet(
        STORAGE_KEYS.TOKEN,
        action.payload.token
      );
    },

    // =======================================================================
    // Update User
    // =======================================================================

    updateUser(
      state,
      action
    ) {
      state.user = {
        ...state.user,
        ...action.payload,
      };

      state.permissions =
        state.user
          ?.permissions ||
        state.permissions;

      state.roles =
        state.user?.roles ||
        state.roles;

      state.features =
        state.user
          ?.features ||
        state.features;

      safeStorageSet(
        STORAGE_KEYS.USER,
        state.user
      );
    },

    // =======================================================================
    // Update Permissions
    // =======================================================================

    setPermissions(
      state,
      action
    ) {
      state.permissions =
        action.payload || [];
    },

    setRoles(
      state,
      action
    ) {
      state.roles =
        action.payload || [];
    },

    setFeatures(
      state,
      action
    ) {
      state.features =
        action.payload || [];
    },

    // =======================================================================
    // Tenant Switching
    // =======================================================================

    setTenant(
      state,
      action
    ) {
      state.tenantId =
        action.payload;

      safeStorageSet(
        STORAGE_KEYS.TENANT,
        action.payload
      );
    },

    // =======================================================================
    // Activity Tracking
    // =======================================================================

    touchSession(
      state
    ) {
      state.lastActivityAt =
        Date.now();
    },

    // =======================================================================
    // Session Expired
    // =======================================================================

    sessionExpired(
      state
    ) {
      state.sessionExpired =
        true;

      state.authenticated =
        false;

      state.loading = false;
    },

    // =======================================================================
    // Clear Error
    // =======================================================================

    clearAuthError(
      state
    ) {
      state.error = null;
    },

    // =======================================================================
    // Logout
    // =======================================================================

    logout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken =
        null;
      state.authenticated =
        false;
      state.loading = false;
      state.permissions = [];
      state.roles = [];
      state.features = [];
      state.tenantId = null;
      state.error = null;
      state.sessionExpired =
        false;
      state.loginMethod =
        null;

      safeStorageRemove(
        STORAGE_KEYS.TOKEN
      );

      safeStorageRemove(
        STORAGE_KEYS
          .REFRESH_TOKEN
      );

      safeStorageRemove(
        STORAGE_KEYS.USER
      );

      safeStorageRemove(
        STORAGE_KEYS.TENANT
      );
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeAuth,
  setAuthLoading,
  loginStart,
  loginSuccess,
  loginFailure,
  refreshTokenSuccess,
  updateUser,
  setPermissions,
  setRoles,
  setFeatures,
  setTenant,
  touchSession,
  sessionExpired,
  clearAuthError,
  logout,
} = authSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectAuth =
  (state) => state.auth;

export const selectUser =
  (state) =>
    state.auth.user;

export const selectToken =
  (state) =>
    state.auth.token;

export const selectTenant =
  (state) =>
    state.auth.tenantId;

export const selectFeatures =
  (state) =>
    state.auth.features;

export const selectPermissions =
  (state) =>
    state.auth.permissions;

export const selectRoles =
  (state) =>
    state.auth.roles;

export const selectAuthenticated =
  (state) =>
    state.auth
      .authenticated;

export const selectAuthLoading =
  (state) =>
    state.auth.loading;

export const selectSessionExpired =
  (state) =>
    state.auth
      .sessionExpired;

// ============================================================================
// Memoized Selectors
// ============================================================================

export const selectHasPermission =
  createSelector(
    [
      selectPermissions,
      (_, permission) =>
        permission,
    ],
    (
      permissions,
      permission
    ) =>
      permissions.includes(
        permission
      )
  );

export const selectHasFeature =
  createSelector(
    [
      selectFeatures,
      (_, feature) =>
        feature,
    ],
    (
      features,
      feature
    ) =>
      features.includes(
        feature
      )
  );

export const selectHasRole =
  createSelector(
    [
      selectRoles,
      (_, role) => role,
    ],
    (roles, role) =>
      roles.includes(role)
  );

// ============================================================================
// Reducer
// ============================================================================

export default authSlice.reducer;