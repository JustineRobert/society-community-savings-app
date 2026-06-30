// ============================================================================
// TITech Community Capital
// Enterprise Feature Flags Slice
// File: frontend/src/features/featureFlags/featureFlagSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createSelector,
} from "@reduxjs/toolkit";

// ============================================================================
// Default Feature Flags
// ============================================================================

export const DEFAULT_FEATURE_FLAGS = {
  // Core Platform
  dashboard: true,
  notifications: true,
  reports: true,
  auditLogs: true,
  analytics: true,

  // Financial Services
  savings: true,
  loans: true,
  wallets: true,
  transactions: true,
  accounting: true,
  mobileMoney: true,

  // Advanced Modules
  ussd: true,
  fraudDetection: true,
  riskScoring: true,
  executiveDashboard: true,
  regulatoryReporting: true,
  documentStorage: true,
  reportExport: true,

  // Administration
  userManagement: true,
  roleManagement: true,
  tenantManagement: true,
  featureManagement: true,
  systemHealth: true,
  metrics: true,

  // Communication
  sms: true,
  email: true,
  pushNotifications: true,
  realtimeNotifications: true,

  // Experimental Features
  aiAssistant: false,
  predictiveAnalytics: false,
  chatbot: false,
  betaFeatures: false,
};

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  initialized: false,

  flags: {
    ...DEFAULT_FEATURE_FLAGS,
  },

  metadata: {
    environment:
      import.meta.env.MODE ||
      "development",
    version:
      import.meta.env.VITE_APP_VERSION ||
      "1.0.0",
    loadedAt: null,
    source: "default",
  },

  loading: false,
  syncing: false,
  error: null,

  history: [],
};

// ============================================================================
// Helpers
// ============================================================================

function addHistory(
  state,
  action,
  enabled
) {
  state.history.unshift({
    feature: action.payload,
    enabled,
    timestamp:
      new Date().toISOString(),
  });

  if (state.history.length > 100) {
    state.history.pop();
  }
}

// ============================================================================
// Slice
// ============================================================================

const featureFlagSlice =
  createSlice({
    name: "featureFlags",

    initialState,

    reducers: {
      // =====================================================================
      // Initialization
      // =====================================================================

      initializeFeatureFlags(
        state,
        action
      ) {
        state.initialized = true;
        state.metadata.loadedAt =
          new Date().toISOString();

        if (action.payload) {
          state.flags = {
            ...state.flags,
            ...action.payload,
          };
        }
      },

      resetFeatureFlags(
        state
      ) {
        state.flags = {
          ...DEFAULT_FEATURE_FLAGS,
        };

        state.error = null;
        state.syncing = false;
        state.loading = false;
        state.history = [];
      },

      // =====================================================================
      // Loading States
      // =====================================================================

      setFeatureLoading(
        state,
        action
      ) {
        state.loading =
          action.payload;
      },

      setFeatureSyncing(
        state,
        action
      ) {
        state.syncing =
          action.payload;
      },

      setFeatureError(
        state,
        action
      ) {
        state.error =
          action.payload;
      },

      clearFeatureError(
        state
      ) {
        state.error = null;
      },

      // =====================================================================
      // Single Feature Operations
      // =====================================================================

      enableFeature(
        state,
        action
      ) {
        state.flags[
          action.payload
        ] = true;

        addHistory(
          state,
          action,
          true
        );
      },

      disableFeature(
        state,
        action
      ) {
        state.flags[
          action.payload
        ] = false;

        addHistory(
          state,
          action,
          false
        );
      },

      toggleFeature(
        state,
        action
      ) {
        const current =
          !!state.flags[
            action.payload
          ];

        state.flags[
          action.payload
        ] = !current;

        addHistory(
          state,
          action,
          !current
        );
      },

      setFeature(
        state,
        action
      ) {
        const {
          feature,
          enabled,
        } = action.payload;

        state.flags[
          feature
        ] = enabled;

        state.history.unshift({
          feature,
          enabled,
          timestamp:
            new Date().toISOString(),
        });
      },

      // =====================================================================
      // Bulk Operations
      // =====================================================================

      setFeatures(
        state,
        action
      ) {
        state.flags = {
          ...state.flags,
          ...action.payload,
        };

        state.metadata.loadedAt =
          new Date().toISOString();
      },

      enableFeatures(
        state,
        action
      ) {
        action.payload.forEach(
          (feature) => {
            state.flags[
              feature
            ] = true;
          }
        );
      },

      disableFeatures(
        state,
        action
      ) {
        action.payload.forEach(
          (feature) => {
            state.flags[
              feature
            ] = false;
          }
        );
      },

      // =====================================================================
      // Environment Support
      // =====================================================================

      setFeatureEnvironment(
        state,
        action
      ) {
        state.metadata.environment =
          action.payload;
      },

      setFeatureSource(
        state,
        action
      ) {
        state.metadata.source =
          action.payload;
      },

      // =====================================================================
      // Import / Export
      // =====================================================================

      importFeatureFlags(
        state,
        action
      ) {
        state.flags = {
          ...DEFAULT_FEATURE_FLAGS,
          ...action.payload,
        };

        state.metadata.loadedAt =
          new Date().toISOString();

        state.metadata.source =
          "import";
      },

      clearFeatureHistory(
        state
      ) {
        state.history = [];
      },
    },
  });

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeFeatureFlags,
  resetFeatureFlags,
  setFeatureLoading,
  setFeatureSyncing,
  setFeatureError,
  clearFeatureError,
  enableFeature,
  disableFeature,
  toggleFeature,
  setFeature,
  setFeatures,
  enableFeatures,
  disableFeatures,
  setFeatureEnvironment,
  setFeatureSource,
  importFeatureFlags,
  clearFeatureHistory,
} =
  featureFlagSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectFeatureFlags =
  (state) =>
    state.featureFlags;

export const selectFlags =
  (state) =>
    state.featureFlags.flags;

export const selectFeatureMetadata =
  (state) =>
    state.featureFlags.metadata;

export const selectFeatureHistory =
  (state) =>
    state.featureFlags.history;

export const selectFeatureLoading =
  (state) =>
    state.featureFlags.loading;

export const selectFeatureError =
  (state) =>
    state.featureFlags.error;

// ============================================================================
// Dynamic Feature Selector
// ============================================================================

export const makeSelectFeature =
  (feature) =>
    createSelector(
      [selectFlags],
      (flags) =>
        !!flags[feature]
    );

// ============================================================================
// Common Feature Selectors
// ============================================================================

export const selectDashboardFeature =
  makeSelectFeature(
    "dashboard"
  );

export const selectLoansFeature =
  makeSelectFeature(
    "loans"
  );

export const selectSavingsFeature =
  makeSelectFeature(
    "savings"
  );

export const selectWalletFeature =
  makeSelectFeature(
    "wallets"
  );

export const selectUSSDFeature =
  makeSelectFeature(
    "ussd"
  );

export const selectFraudFeature =
  makeSelectFeature(
    "fraudDetection"
  );

export const selectAnalyticsFeature =
  makeSelectFeature(
    "analytics"
  );

export const selectExecutiveDashboardFeature =
  makeSelectFeature(
    "executiveDashboard"
  );

export const selectRegulatoryReportingFeature =
  makeSelectFeature(
    "regulatoryReporting"
  );

// ============================================================================
// Utility Helpers
// ============================================================================

export const isFeatureEnabled =
  (state, feature) =>
    !!state.featureFlags.flags[
      feature
    ];

export const getEnabledFeatures =
  (state) =>
    Object.entries(
      state.featureFlags.flags
    )
      .filter(
        ([, enabled]) =>
          enabled
      )
      .map(
        ([feature]) =>
          feature
      );

export const getDisabledFeatures =
  (state) =>
    Object.entries(
      state.featureFlags.flags
    )
      .filter(
        ([, enabled]) =>
          !enabled
      )
      .map(
        ([feature]) =>
          feature
      );

// ============================================================================
// Reducer
// ============================================================================

export default
  featureFlagSlice.reducer;