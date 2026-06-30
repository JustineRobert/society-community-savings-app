// ============================================================================
// TITech Community Capital
// Enterprise Notification Slice
// File: frontend/src/features/notification/notificationSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createSelector,
  nanoid,
} from "@reduxjs/toolkit";

// ============================================================================
// Constants
// ============================================================================

export const NOTIFICATION_TYPES = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  SYSTEM: "system",
  SECURITY: "security",
  TRANSACTION: "transaction",
};

export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
};

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  items: [],
  unreadCount: 0,
  loading: false,
  syncing: false,
  error: null,
  lastFetchedAt: null,
  preferences: {
    email: true,
    sms: false,
    push: true,
    inApp: true,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function recalculateUnread(state) {
  state.unreadCount =
    state.items.filter(
      (n) => !n.read
    ).length;
}

function normalizeNotification(
  payload
) {
  return {
    id:
      payload.id ||
      payload._id ||
      nanoid(),

    title:
      payload.title ||
      "Notification",

    message:
      payload.message ||
      "",

    type:
      payload.type ||
      NOTIFICATION_TYPES.INFO,

    channel:
      payload.channel ||
      NOTIFICATION_CHANNELS.IN_APP,

    read:
      payload.read || false,

    archived:
      payload.archived || false,

    createdAt:
      payload.createdAt ||
      new Date().toISOString(),

    metadata:
      payload.metadata || {},

    action:
      payload.action || null,

    priority:
      payload.priority ||
      "normal",
  };
}

// ============================================================================
// Slice
// ============================================================================

const notificationSlice =
  createSlice({
    name: "notifications",

    initialState,

    reducers: {
      // =====================================================================
      // Loading
      // =====================================================================

      setNotificationsLoading(
        state,
        action
      ) {
        state.loading =
          action.payload;
      },

      setNotificationsSyncing(
        state,
        action
      ) {
        state.syncing =
          action.payload;
      },

      setNotificationsError(
        state,
        action
      ) {
        state.error =
          action.payload;
      },

      clearNotificationsError(
        state
      ) {
        state.error = null;
      },

      // =====================================================================
      // Set Notifications
      // =====================================================================

      setNotifications(
        state,
        action
      ) {
        state.items =
          action.payload.map(
            normalizeNotification
          );

        state.lastFetchedAt =
          new Date().toISOString();

        recalculateUnread(
          state
        );
      },

      // =====================================================================
      // Add Notification
      // =====================================================================

      addNotification(
        state,
        action
      ) {
        const notification =
          normalizeNotification(
            action.payload
          );

        state.items.unshift(
          notification
        );

        recalculateUnread(
          state
        );
      },

      addNotifications(
        state,
        action
      ) {
        const notifications =
          action.payload.map(
            normalizeNotification
          );

        state.items.unshift(
          ...notifications
        );

        recalculateUnread(
          state
        );
      },

      // =====================================================================
      // Update Notification
      // =====================================================================

      updateNotification(
        state,
        action
      ) {
        const {
          id,
          updates,
        } = action.payload;

        const index =
          state.items.findIndex(
            (n) =>
              n.id === id
          );

        if (
          index !== -1
        ) {
          state.items[
            index
          ] = {
            ...state.items[
              index
            ],
            ...updates,
          };
        }

        recalculateUnread(
          state
        );
      },

      // =====================================================================
      // Read State
      // =====================================================================

      markAsRead(
        state,
        action
      ) {
        const notification =
          state.items.find(
            (n) =>
              n.id ===
              action.payload
          );

        if (
          notification
        ) {
          notification.read =
            true;
        }

        recalculateUnread(
          state
        );
      },

      markAsUnread(
        state,
        action
      ) {
        const notification =
          state.items.find(
            (n) =>
              n.id ===
              action.payload
          );

        if (
          notification
        ) {
          notification.read =
            false;
        }

        recalculateUnread(
          state
        );
      },

      markAllAsRead(
        state
      ) {
        state.items.forEach(
          (n) => {
            n.read = true;
          }
        );

        state.unreadCount = 0;
      },

      // =====================================================================
      // Archive
      // =====================================================================

      archiveNotification(
        state,
        action
      ) {
        const notification =
          state.items.find(
            (n) =>
              n.id ===
              action.payload
          );

        if (
          notification
        ) {
          notification.archived =
            true;
        }
      },

      unarchiveNotification(
        state,
        action
      ) {
        const notification =
          state.items.find(
            (n) =>
              n.id ===
              action.payload
          );

        if (
          notification
        ) {
          notification.archived =
            false;
        }
      },

      // =====================================================================
      // Delete
      // =====================================================================

      removeNotification(
        state,
        action
      ) {
        state.items =
          state.items.filter(
            (n) =>
              n.id !==
              action.payload
          );

        recalculateUnread(
          state
        );
      },

      clearNotifications(
        state
      ) {
        state.items = [];
        state.unreadCount = 0;
      },

      clearArchivedNotifications(
        state
      ) {
        state.items =
          state.items.filter(
            (n) =>
              !n.archived
          );

        recalculateUnread(
          state
        );
      },

      // =====================================================================
      // Preferences
      // =====================================================================

      setNotificationPreferences(
        state,
        action
      ) {
        state.preferences = {
          ...state.preferences,
          ...action.payload,
        };
      },

      // =====================================================================
      // Reset
      // =====================================================================

      resetNotificationState() {
        return initialState;
      },
    },
  });

// ============================================================================
// Actions
// ============================================================================

export const {
  setNotificationsLoading,
  setNotificationsSyncing,
  setNotificationsError,
  clearNotificationsError,
  setNotifications,
  addNotification,
  addNotifications,
  updateNotification,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  archiveNotification,
  unarchiveNotification,
  removeNotification,
  clearNotifications,
  clearArchivedNotifications,
  setNotificationPreferences,
  resetNotificationState,
} =
  notificationSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectNotifications =
  (state) =>
    state.notifications.items;

export const selectUnreadCount =
  (state) =>
    state.notifications
      .unreadCount;

export const selectNotificationLoading =
  (state) =>
    state.notifications.loading;

export const selectNotificationSyncing =
  (state) =>
    state.notifications.syncing;

export const selectNotificationError =
  (state) =>
    state.notifications.error;

export const selectNotificationPreferences =
  (state) =>
    state.notifications
      .preferences;

export const selectUnreadNotifications =
  createSelector(
    [selectNotifications],
    (notifications) =>
      notifications.filter(
        (n) => !n.read
      )
  );

export const selectArchivedNotifications =
  createSelector(
    [selectNotifications],
    (notifications) =>
      notifications.filter(
        (n) =>
          n.archived
      )
  );

export const selectSecurityNotifications =
  createSelector(
    [selectNotifications],
    (notifications) =>
      notifications.filter(
        (n) =>
          n.type ===
          NOTIFICATION_TYPES.SECURITY
      )
  );

export const selectTransactionNotifications =
  createSelector(
    [selectNotifications],
    (notifications) =>
      notifications.filter(
        (n) =>
          n.type ===
          NOTIFICATION_TYPES.TRANSACTION
      )
  );

// ============================================================================
// Reducer
// ============================================================================

export default
  notificationSlice.reducer;