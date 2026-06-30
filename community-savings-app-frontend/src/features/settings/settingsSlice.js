// ============================================================================
// TITech Community Capital
// Enterprise Settings Slice
// File: frontend/src/features/settings/settingsSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createSelector,
} from "@reduxjs/toolkit";

// ============================================================================
// Constants
// ============================================================================

export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
};

export const LANGUAGES = {
  ENGLISH: "en",
  SWAHILI: "sw",
  FRENCH: "fr",
};

export const CURRENCIES = {
  UGX: "UGX",
  USD: "USD",
  KES: "KES",
  TZS: "TZS",
};

export const DATE_FORMATS = {
  DDMMYYYY: "DD/MM/YYYY",
  MMDDYYYY: "MM/DD/YYYY",
  YYYYMMDD: "YYYY-MM-DD",
};

export const TIME_FORMATS = {
  H12: "12h",
  H24: "24h",
};

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  initialized: false,

  appearance: {
    theme: THEMES.SYSTEM,
    compactMode: false,
    animations: true,
    fontSize: "medium",
    density: "comfortable",
  },

  localization: {
    language: LANGUAGES.ENGLISH,
    currency: CURRENCIES.UGX,
    timezone:
      Intl.DateTimeFormat().resolvedOptions()
        .timeZone || "Africa/Kampala",
    dateFormat:
      DATE_FORMATS.DDMMYYYY,
    timeFormat:
      TIME_FORMATS.H24,
  },

  notifications: {
    email: true,
    sms: true,
    push: true,
    inApp: true,
    securityAlerts: true,
    transactionAlerts: true,
    marketing: false,
  },

  privacy: {
    analytics: true,
    telemetry: true,
    rememberMe: true,
    autoLogout: true,
    autoLogoutMinutes: 30,
  },

  dashboard: {
    autoRefresh: true,
    refreshInterval: 60000,
    showBalances: true,
    defaultLandingPage:
      "/dashboard",
    widgets: [],
  },

  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
  },

  integrations: {
    mobileMoney: true,
    email: true,
    sms: true,
    realtime: true,
  },

  loading: false,
  saving: false,
  error: null,
  lastUpdated: null,
};

// ============================================================================
// Slice
// ============================================================================

const settingsSlice =
  createSlice({
    name: "settings",

    initialState,

    reducers: {
      // =====================================================================
      // Initialization
      // =====================================================================

      initializeSettings(
        state
      ) {
        state.initialized = true;
      },

      resetSettings() {
        return initialState;
      },

      // =====================================================================
      // Loading States
      // =====================================================================

      setSettingsLoading(
        state,
        action
      ) {
        state.loading =
          action.payload;
      },

      setSettingsSaving(
        state,
        action
      ) {
        state.saving =
          action.payload;
      },

      setSettingsError(
        state,
        action
      ) {
        state.error =
          action.payload;
      },

      clearSettingsError(
        state
      ) {
        state.error = null;
      },

      // =====================================================================
      // Appearance
      // =====================================================================

      setTheme(
        state,
        action
      ) {
        state.appearance.theme =
          action.payload;
      },

      setCompactMode(
        state,
        action
      ) {
        state.appearance.compactMode =
          action.payload;
      },

      setAnimations(
        state,
        action
      ) {
        state.appearance.animations =
          action.payload;
      },

      setFontSize(
        state,
        action
      ) {
        state.appearance.fontSize =
          action.payload;
      },

      setDensity(
        state,
        action
      ) {
        state.appearance.density =
          action.payload;
      },

      // =====================================================================
      // Localization
      // =====================================================================

      setLanguage(
        state,
        action
      ) {
        state.localization.language =
          action.payload;
      },

      setCurrency(
        state,
        action
      ) {
        state.localization.currency =
          action.payload;
      },

      setTimezone(
        state,
        action
      ) {
        state.localization.timezone =
          action.payload;
      },

      setDateFormat(
        state,
        action
      ) {
        state.localization.dateFormat =
          action.payload;
      },

      setTimeFormat(
        state,
        action
      ) {
        state.localization.timeFormat =
          action.payload;
      },

      // =====================================================================
      // Notifications
      // =====================================================================

      updateNotificationSettings(
        state,
        action
      ) {
        state.notifications = {
          ...state.notifications,
          ...action.payload,
        };
      },

      // =====================================================================
      // Privacy
      // =====================================================================

      updatePrivacySettings(
        state,
        action
      ) {
        state.privacy = {
          ...state.privacy,
          ...action.payload,
        };
      },

      // =====================================================================
      // Dashboard
      // =====================================================================

      updateDashboardSettings(
        state,
        action
      ) {
        state.dashboard = {
          ...state.dashboard,
          ...action.payload,
        };
      },

      addDashboardWidget(
        state,
        action
      ) {
        if (
          !state.dashboard.widgets.includes(
            action.payload
          )
        ) {
          state.dashboard.widgets.push(
            action.payload
          );
        }
      },

      removeDashboardWidget(
        state,
        action
      ) {
        state.dashboard.widgets =
          state.dashboard.widgets.filter(
            (w) =>
              w !== action.payload
          );
      },

      // =====================================================================
      // Accessibility
      // =====================================================================

      updateAccessibilitySettings(
        state,
        action
      ) {
        state.accessibility = {
          ...state.accessibility,
          ...action.payload,
        };
      },

      // =====================================================================
      // Integrations
      // =====================================================================

      updateIntegrationSettings(
        state,
        action
      ) {
        state.integrations = {
          ...state.integrations,
          ...action.payload,
        };
      },

      // =====================================================================
      // Bulk Update
      // =====================================================================

      updateSettings(
        state,
        action
      ) {
        const payload =
          action.payload;

        Object.keys(
          payload
        ).forEach((key) => {
          if (
            state[key]
          ) {
            state[key] = {
              ...state[key],
              ...payload[key],
            };
          }
        });

        state.lastUpdated =
          new Date().toISOString();
      },

      // =====================================================================
      // Import/Export
      // =====================================================================

      importSettings(
        state,
        action
      ) {
        return {
          ...state,
          ...action.payload,
          initialized: true,
          lastUpdated:
            new Date().toISOString(),
        };
      },
    },
  });

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeSettings,
  resetSettings,
  setSettingsLoading,
  setSettingsSaving,
  setSettingsError,
  clearSettingsError,
  setTheme,
  setCompactMode,
  setAnimations,
  setFontSize,
  setDensity,
  setLanguage,
  setCurrency,
  setTimezone,
  setDateFormat,
  setTimeFormat,
  updateNotificationSettings,
  updatePrivacySettings,
  updateDashboardSettings,
  addDashboardWidget,
  removeDashboardWidget,
  updateAccessibilitySettings,
  updateIntegrationSettings,
  updateSettings,
  importSettings,
} =
  settingsSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectSettings =
  (state) =>
    state.settings;

export const selectAppearance =
  (state) =>
    state.settings.appearance;

export const selectLocalization =
  (state) =>
    state.settings.localization;

export const selectNotifications =
  (state) =>
    state.settings.notifications;

export const selectPrivacy =
  (state) =>
    state.settings.privacy;

export const selectDashboardSettings =
  (state) =>
    state.settings.dashboard;

export const selectAccessibility =
  (state) =>
    state.settings.accessibility;

export const selectIntegrations =
  (state) =>
    state.settings.integrations;

export const selectTheme =
  createSelector(
    [selectAppearance],
    (appearance) =>
      appearance.theme
  );

export const selectLanguage =
  createSelector(
    [selectLocalization],
    (localization) =>
      localization.language
  );

export const selectCurrency =
  createSelector(
    [selectLocalization],
    (localization) =>
      localization.currency
  );

export const selectDashboardWidgets =
  createSelector(
    [selectDashboardSettings],
    (dashboard) =>
      dashboard.widgets
  );

export const selectAutoRefresh =
  createSelector(
    [selectDashboardSettings],
    (dashboard) =>
      dashboard.autoRefresh
  );

export const selectRefreshInterval =
  createSelector(
    [selectDashboardSettings],
    (dashboard) =>
      dashboard.refreshInterval
  );

// ============================================================================
// Reducer
// ============================================================================

export default
  settingsSlice.reducer;