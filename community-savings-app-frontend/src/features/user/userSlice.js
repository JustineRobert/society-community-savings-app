// ============================================================================
// TITech Community Capital
// Enterprise User Slice
// File: frontend/src/features/user/userSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createSelector,
} from "@reduxjs/toolkit";

// ============================================================================
// Storage Helpers
// ============================================================================

const STORAGE_KEY =
  "userProfile";

function loadProfile() {
  try {
    const profile =
      localStorage.getItem(
        STORAGE_KEY
      );

    return profile
      ? JSON.parse(profile)
      : null;
  } catch {
    return null;
  }
}

function saveProfile(
  profile
) {
  try {
    if (!profile) {
      localStorage.removeItem(
        STORAGE_KEY
      );
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(profile)
    );
  } catch (err) {
    console.error(
      "Failed to save profile",
      err
    );
  }
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  profile: loadProfile(),

  loading: false,

  saving: false,

  initialized: false,

  error: null,

  lastUpdated: null,

  preferences: {},

  notifications: {},

  permissions: [],

  roles: [],

  features: [],

  activity: [],

  devices: [],

  sessions: [],
};

// ============================================================================
// Slice
// ============================================================================

const userSlice =
  createSlice({
    name: "user",

    initialState,

    reducers: {
      // =====================================================================
      // Initialization
      // =====================================================================

      initializeUser(
        state
      ) {
        state.initialized =
          true;
      },

      // =====================================================================
      // Loading
      // =====================================================================

      setLoading(
        state,
        action
      ) {
        state.loading =
          action.payload;
      },

      setSaving(
        state,
        action
      ) {
        state.saving =
          action.payload;
      },

      // =====================================================================
      // User Profile
      // =====================================================================

      setUser(
        state,
        action
      ) {
        const profile =
          action.payload;

        state.profile =
          profile;

        state.permissions =
          profile
            ?.permissions ||
          [];

        state.roles =
          profile?.roles ||
          (profile?.role
            ? [profile.role]
            : []);

        state.features =
          profile?.features ||
          [];

        state.preferences =
          profile
            ?.preferences ||
          {};

        state.notifications =
          profile
            ?.notifications ||
          {};

        state.lastUpdated =
          new Date().toISOString();

        state.error = null;

        saveProfile(
          profile
        );
      },

      updateUser(
        state,
        action
      ) {
        state.profile = {
          ...state.profile,
          ...action.payload,
        };

        state.lastUpdated =
          new Date().toISOString();

        saveProfile(
          state.profile
        );
      },

      updatePreferences(
        state,
        action
      ) {
        state.preferences = {
          ...state.preferences,
          ...action.payload,
        };

        if (
          state.profile
        ) {
          state.profile.preferences =
            state.preferences;

          saveProfile(
            state.profile
          );
        }
      },

      updateNotifications(
        state,
        action
      ) {
        state.notifications =
          {
            ...state.notifications,
            ...action.payload,
          };

        if (
          state.profile
        ) {
          state.profile.notifications =
            state.notifications;

          saveProfile(
            state.profile
          );
        }
      },

      // =====================================================================
      // Permissions / Roles / Features
      // =====================================================================

      setPermissions(
        state,
        action
      ) {
        state.permissions =
          action.payload ||
          [];
      },

      setRoles(
        state,
        action
      ) {
        state.roles =
          action.payload ||
          [];
      },

      setFeatures(
        state,
        action
      ) {
        state.features =
          action.payload ||
          [];
      },

      // =====================================================================
      // User Activity
      // =====================================================================

      setActivity(
        state,
        action
      ) {
        state.activity =
          action.payload ||
          [];
      },

      addActivity(
        state,
        action
      ) {
        state.activity.unshift(
          action.payload
        );

        if (
          state.activity
            .length > 100
        ) {
          state.activity.pop();
        }
      },

      // =====================================================================
      // Sessions
      // =====================================================================

      setSessions(
        state,
        action
      ) {
        state.sessions =
          action.payload ||
          [];
      },

      addSession(
        state,
        action
      ) {
        state.sessions.push(
          action.payload
        );
      },

      removeSession(
        state,
        action
      ) {
        state.sessions =
          state.sessions.filter(
            (session) =>
              session.id !==
              action.payload
          );
      },

      // =====================================================================
      // Devices
      // =====================================================================

      setDevices(
        state,
        action
      ) {
        state.devices =
          action.payload ||
          [];
      },

      // =====================================================================
      // Error Handling
      // =====================================================================

      setError(
        state,
        action
      ) {
        state.error =
          action.payload;
      },

      clearError(
        state
      ) {
        state.error =
          null;
      },

      // =====================================================================
      // Clear User
      // =====================================================================

      clearUser(
        state
      ) {
        state.profile =
          null;

        state.permissions =
          [];

        state.roles = [];

        state.features =
          [];

        state.preferences =
          {};

        state.notifications =
          {};

        state.activity =
          [];

        state.sessions =
          [];

        state.devices =
          [];

        state.loading =
          false;

        state.saving =
          false;

        state.error =
          null;

        state.lastUpdated =
          null;

        localStorage.removeItem(
          STORAGE_KEY
        );
      },
    },
  });

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeUser,
  setLoading,
  setSaving,
  setUser,
  updateUser,
  updatePreferences,
  updateNotifications,
  setPermissions,
  setRoles,
  setFeatures,
  setActivity,
  addActivity,
  setSessions,
  addSession,
  removeSession,
  setDevices,
  setError,
  clearError,
  clearUser,
} = userSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectUser =
  (state) =>
    state.user.profile;

export const selectUserLoading =
  (state) =>
    state.user.loading;

export const selectUserSaving =
  (state) =>
    state.user.saving;

export const selectUserError =
  (state) =>
    state.user.error;

export const selectUserRoles =
  (state) =>
    state.user.roles;

export const selectUserPermissions =
  (state) =>
    state.user.permissions;

export const selectUserFeatures =
  (state) =>
    state.user.features;

export const selectUserPreferences =
  (state) =>
    state.user.preferences;

export const selectUserNotifications =
  (state) =>
    state.user.notifications;

export const selectUserActivity =
  (state) =>
    state.user.activity;

export const selectUserSessions =
  (state) =>
    state.user.sessions;

export const selectUserDevices =
  (state) =>
    state.user.devices;

// ============================================================================
// Memoized Selectors
// ============================================================================

export const selectHasRole =
  createSelector(
    [
      selectUserRoles,
      (_, role) => role,
    ],
    (roles, role) =>
      roles.includes(role)
  );

export const selectHasPermission =
  createSelector(
    [
      selectUserPermissions,
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
      selectUserFeatures,
      (_, feature) =>
        feature,
    ],
    (features, feature) =>
      features.includes(
        feature
      )
  );

export const selectUserFullName =
  createSelector(
    [selectUser],
    (user) => {
      if (!user)
        return "";

      return [
        user.firstName,
        user.lastName,
      ]
        .filter(Boolean)
        .join(" ");
    }
  );

// ============================================================================
// Reducer
// ============================================================================

export default userSlice.reducer;