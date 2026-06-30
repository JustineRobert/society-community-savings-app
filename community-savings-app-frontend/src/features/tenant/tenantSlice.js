// ============================================================================
// TITech Community Capital
// Enterprise Tenant Slice
// File: frontend/src/features/tenant/tenantSlice.js
// Production Grade
// ============================================================================

import { createSlice } from "@reduxjs/toolkit";

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  currentTenant: null,

  tenants: [],

  loading: false,

  switching: false,

  initialized: false,

  error: null,

  statistics: null,

  lastTenantId: null,

  selectedPlan: null,

  features: [],

  permissions: [],
};

// ============================================================================
// Slice
// ============================================================================

const tenantSlice = createSlice({
  name: "tenant",

  initialState,

  reducers: {
    // =======================================================================
    // Initialization
    // =======================================================================

    initializeTenantState(state) {
      state.initialized = true;
    },

    // =======================================================================
    // Loading
    // =======================================================================

    setTenantLoading(state, action) {
      state.loading = action.payload;
    },

    setTenantSwitching(state, action) {
      state.switching = action.payload;
    },

    setTenantError(state, action) {
      state.error = action.payload;
    },

    clearTenantError(state) {
      state.error = null;
    },

    // =======================================================================
    // Current Tenant
    // =======================================================================

    setTenant(state, action) {
      const tenant = action.payload;

      state.currentTenant = tenant;
      state.lastTenantId = tenant?.id || tenant?._id || null;

      state.features =
        tenant?.features || [];

      state.permissions =
        tenant?.permissions || [];

      state.selectedPlan =
        tenant?.plan || null;
    },

    clearTenant(state) {
      state.currentTenant = null;
      state.features = [];
      state.permissions = [];
      state.selectedPlan = null;
      state.lastTenantId = null;
    },

    // =======================================================================
    // Tenant List
    // =======================================================================

    setTenants(state, action) {
      state.tenants = action.payload || [];
    },

    addTenant(state, action) {
      state.tenants.push(action.payload);
    },

    updateTenant(state, action) {
      const tenant = action.payload;

      const index = state.tenants.findIndex(
        (t) =>
          t.id === tenant.id ||
          t._id === tenant._id
      );

      if (index !== -1) {
        state.tenants[index] = {
          ...state.tenants[index],
          ...tenant,
        };
      }

      if (
        state.currentTenant &&
        (state.currentTenant.id === tenant.id ||
          state.currentTenant._id ===
            tenant._id)
      ) {
        state.currentTenant = {
          ...state.currentTenant,
          ...tenant,
        };

        state.features =
          tenant.features ||
          state.features;

        state.permissions =
          tenant.permissions ||
          state.permissions;

        state.selectedPlan =
          tenant.plan ||
          state.selectedPlan;
      }
    },

    removeTenant(state, action) {
      const tenantId = action.payload;

      state.tenants = state.tenants.filter(
        (tenant) =>
          tenant.id !== tenantId &&
          tenant._id !== tenantId
      );

      if (
        state.currentTenant &&
        (state.currentTenant.id === tenantId ||
          state.currentTenant._id === tenantId)
      ) {
        state.currentTenant = null;
        state.features = [];
        state.permissions = [];
        state.selectedPlan = null;
      }
    },

    // =======================================================================
    // Features
    // =======================================================================

    setTenantFeatures(state, action) {
      state.features =
        action.payload || [];

      if (state.currentTenant) {
        state.currentTenant.features =
          action.payload;
      }
    },

    addTenantFeature(state, action) {
      const feature = action.payload;

      if (
        !state.features.includes(feature)
      ) {
        state.features.push(feature);
      }

      if (state.currentTenant) {
        state.currentTenant.features =
          state.features;
      }
    },

    removeTenantFeature(state, action) {
      const feature = action.payload;

      state.features =
        state.features.filter(
          (f) => f !== feature
        );

      if (state.currentTenant) {
        state.currentTenant.features =
          state.features;
      }
    },

    // =======================================================================
    // Permissions
    // =======================================================================

    setTenantPermissions(state, action) {
      state.permissions =
        action.payload || [];

      if (state.currentTenant) {
        state.currentTenant.permissions =
          action.payload;
      }
    },

    // =======================================================================
    // Plan Management
    // =======================================================================

    setTenantPlan(state, action) {
      state.selectedPlan =
        action.payload;

      if (state.currentTenant) {
        state.currentTenant.plan =
          action.payload;
      }
    },

    // =======================================================================
    // Statistics
    // =======================================================================

    setTenantStatistics(state, action) {
      state.statistics =
        action.payload;
    },

    clearTenantStatistics(state) {
      state.statistics = null;
    },

    // =======================================================================
    // Reset
    // =======================================================================

    resetTenantState() {
      return initialState;
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeTenantState,
  setTenant,
  setTenants,
  addTenant,
  updateTenant,
  removeTenant,
  clearTenant,
  setTenantLoading,
  setTenantSwitching,
  setTenantError,
  clearTenantError,
  setTenantFeatures,
  addTenantFeature,
  removeTenantFeature,
  setTenantPermissions,
  setTenantPlan,
  setTenantStatistics,
  clearTenantStatistics,
  resetTenantState,
} = tenantSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectTenantState = (
  state
) => state.tenant;

export const selectCurrentTenant = (
  state
) => state.tenant.currentTenant;

export const selectTenantId = (
  state
) =>
  state.tenant.currentTenant?.id ||
  state.tenant.currentTenant?._id;

export const selectTenantName = (
  state
) =>
  state.tenant.currentTenant?.name ||
  "";

export const selectTenantPlan = (
  state
) => state.tenant.selectedPlan;

export const selectTenantFeatures = (
  state
) => state.tenant.features;

export const selectTenantPermissions =
  (state) =>
    state.tenant.permissions;

export const selectTenants = (
  state
) => state.tenant.tenants;

export const selectTenantLoading = (
  state
) => state.tenant.loading;

export const selectTenantSwitching = (
  state
) => state.tenant.switching;

export const selectTenantError = (
  state
) => state.tenant.error;

export const selectTenantStatistics =
  (state) =>
    state.tenant.statistics;

export const selectLastTenantId = (
  state
) => state.tenant.lastTenantId;

// ============================================================================
// Helpers
// ============================================================================

export const hasTenantFeature =
  (feature) => (state) =>
    state.tenant.features.includes(
      feature
    );

export const hasTenantPermission =
  (permission) => (state) =>
    state.tenant.permissions.includes(
      permission
    );

// ============================================================================
// Reducer
// ============================================================================

export default tenantSlice.reducer;