// ============================================================================
// TITech Community Capital
// Enterprise Audit Slice
// File: frontend/src/features/audit/auditSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";

import api from "../../services/api";

// ============================================================================
// Constants
// ============================================================================

export const AUDIT_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
};

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VIEW: "VIEW",
  EXPORT: "EXPORT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  TRANSFER: "TRANSFER",
  DISBURSE: "DISBURSE",
  WITHDRAW: "WITHDRAW",
  DEPOSIT: "DEPOSIT",
  SETTINGS_CHANGE: "SETTINGS_CHANGE",
  FEATURE_CHANGE: "FEATURE_CHANGE",
};

const PAGE_SIZE = 25;

// ============================================================================
// Async Thunks
// ============================================================================

export const fetchAuditLogs =
  createAsyncThunk(
    "audit/fetchAuditLogs",
    async (
      params = {},
      { rejectWithValue }
    ) => {
      try {
        const response =
          await api.get(
            "/api/audit",
            {
              params,
            }
          );

        return (
          response.data ||
          response
        );
      } catch (error) {
        return rejectWithValue(
          error.response?.data ||
            error.message
        );
      }
    }
  );

export const exportAuditLogs =
  createAsyncThunk(
    "audit/exportAuditLogs",
    async (
      params = {},
      { rejectWithValue }
    ) => {
      try {
        const response =
          await api.get(
            "/api/audit/export",
            {
              params,
              responseType:
                "blob",
            }
          );

        return response.data;
      } catch (error) {
        return rejectWithValue(
          error.response?.data ||
            error.message
        );
      }
    }
  );

export const createAuditEntry =
  createAsyncThunk(
    "audit/createAuditEntry",
    async (
      payload,
      { rejectWithValue }
    ) => {
      try {
        const response =
          await api.post(
            "/api/audit",
            payload
          );

        return (
          response.data ||
          response
        );
      } catch (error) {
        return rejectWithValue(
          error.response?.data ||
            error.message
        );
      }
    }
  );

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  entries: [],
  selectedEntry: null,

  pagination: {
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  },

  filters: {
    search: "",
    userId: null,
    tenantId: null,
    action: null,
    severity: null,
    startDate: null,
    endDate: null,
  },

  realtime: {
    enabled: true,
    connected: false,
    lastReceived: null,
  },

  loading: false,
  exporting: false,
  creating: false,

  error: null,
  initialized: false,

  stats: {
    totalLogs: 0,
    critical: 0,
    errors: 0,
    warnings: 0,
    today: 0,
  },
};

// ============================================================================
// Slice
// ============================================================================

const auditSlice =
  createSlice({
    name: "audit",
    initialState,

    reducers: {
      initializeAudit(
        state
      ) {
        state.initialized = true;
      },

      clearAudit(
        state
      ) {
        state.entries = [];
        state.selectedEntry =
          null;
        state.error = null;
      },

      setSelectedAuditEntry(
        state,
        action
      ) {
        state.selectedEntry =
          action.payload;
      },

      clearSelectedAuditEntry(
        state
      ) {
        state.selectedEntry =
          null;
      },

      setAuditFilters(
        state,
        action
      ) {
        state.filters = {
          ...state.filters,
          ...action.payload,
        };
      },

      resetAuditFilters(
        state
      ) {
        state.filters =
          initialState.filters;
      },

      setAuditPagination(
        state,
        action
      ) {
        state.pagination = {
          ...state.pagination,
          ...action.payload,
        };
      },

      setRealtimeEnabled(
        state,
        action
      ) {
        state.realtime.enabled =
          action.payload;
      },

      setRealtimeConnected(
        state,
        action
      ) {
        state.realtime.connected =
          action.payload;
      },

      addRealtimeAuditEntry(
        state,
        action
      ) {
        state.entries.unshift(
          action.payload
        );

        state.realtime.lastReceived =
          new Date().toISOString();

        state.stats.totalLogs += 1;

        if (
          action.payload
            ?.severity ===
          AUDIT_SEVERITY.CRITICAL
        ) {
          state.stats.critical += 1;
        }

        if (
          action.payload
            ?.severity ===
          AUDIT_SEVERITY.ERROR
        ) {
          state.stats.errors += 1;
        }

        if (
          action.payload
            ?.severity ===
          AUDIT_SEVERITY.WARNING
        ) {
          state.stats.warnings += 1;
        }
      },

      removeAuditEntry(
        state,
        action
      ) {
        state.entries =
          state.entries.filter(
            (entry) =>
              entry.id !==
              action.payload
          );
      },

      updateAuditStats(
        state,
        action
      ) {
        state.stats = {
          ...state.stats,
          ...action.payload,
        };
      },

      clearAuditError(
        state
      ) {
        state.error = null;
      },

      resetAuditState() {
        return initialState;
      },
    },

    extraReducers: (
      builder
    ) => {
      builder

        // ================================================================
        // Fetch Logs
        // ================================================================
        .addCase(
          fetchAuditLogs.pending,
          (state) => {
            state.loading =
              true;
            state.error = null;
          }
        )
        .addCase(
          fetchAuditLogs.fulfilled,
          (
            state,
            action
          ) => {
            state.loading =
              false;

            const payload =
              action.payload;

            state.entries =
              payload.data ||
              payload.entries ||
              [];

            if (
              payload.pagination
            ) {
              state.pagination =
                {
                  ...state.pagination,
                  ...payload.pagination,
                };
            }

            if (
              payload.stats
            ) {
              state.stats =
                {
                  ...state.stats,
                  ...payload.stats,
                };
            }

            state.initialized =
              true;
          }
        )
        .addCase(
          fetchAuditLogs.rejected,
          (
            state,
            action
          ) => {
            state.loading =
              false;

            state.error =
              action.payload ||
              "Failed to load audit logs.";
          }
        )

        // ================================================================
        // Export
        // ================================================================
        .addCase(
          exportAuditLogs.pending,
          (state) => {
            state.exporting =
              true;
            state.error = null;
          }
        )
        .addCase(
          exportAuditLogs.fulfilled,
          (state) => {
            state.exporting =
              false;
          }
        )
        .addCase(
          exportAuditLogs.rejected,
          (
            state,
            action
          ) => {
            state.exporting =
              false;

            state.error =
              action.payload ||
              "Failed to export audit logs.";
          }
        )

        // ================================================================
        // Create
        // ================================================================
        .addCase(
          createAuditEntry.pending,
          (state) => {
            state.creating =
              true;
            state.error = null;
          }
        )
        .addCase(
          createAuditEntry.fulfilled,
          (
            state,
            action
          ) => {
            state.creating =
              false;

            if (
              action.payload
            ) {
              state.entries.unshift(
                action.payload
              );
            }
          }
        )
        .addCase(
          createAuditEntry.rejected,
          (
            state,
            action
          ) => {
            state.creating =
              false;

            state.error =
              action.payload ||
              "Failed to create audit entry.";
          }
        );
    },
  });

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeAudit,
  clearAudit,
  setSelectedAuditEntry,
  clearSelectedAuditEntry,
  setAuditFilters,
  resetAuditFilters,
  setAuditPagination,
  setRealtimeEnabled,
  setRealtimeConnected,
  addRealtimeAuditEntry,
  removeAuditEntry,
  updateAuditStats,
  clearAuditError,
  resetAuditState,
} = auditSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectAudit =
  (state) =>
    state.audit;

export const selectAuditEntries =
  (state) =>
    state.audit.entries;

export const selectAuditLoading =
  (state) =>
    state.audit.loading;

export const selectAuditStats =
  (state) =>
    state.audit.stats;

export const selectAuditFilters =
  (state) =>
    state.audit.filters;

export const selectAuditPagination =
  (state) =>
    state.audit.pagination;

export const selectSelectedAuditEntry =
  (state) =>
    state.audit.selectedEntry;

export const selectAuditRealtime =
  (state) =>
    state.audit.realtime;

export const selectCriticalLogs =
  createSelector(
    [selectAuditEntries],
    (entries) =>
      entries.filter(
        (entry) =>
          entry.severity ===
          AUDIT_SEVERITY.CRITICAL
      )
  );

export const selectErrorLogs =
  createSelector(
    [selectAuditEntries],
    (entries) =>
      entries.filter(
        (entry) =>
          entry.severity ===
          AUDIT_SEVERITY.ERROR
      )
  );

export const selectAuditByUser =
  (userId) =>
    createSelector(
      [selectAuditEntries],
      (entries) =>
        entries.filter(
          (entry) =>
            entry.userId ===
            userId
        )
    );

export const selectAuditByAction =
  (action) =>
    createSelector(
      [selectAuditEntries],
      (entries) =>
        entries.filter(
          (entry) =>
            entry.action ===
            action
        )
    );

// ============================================================================
// Reducer
// ============================================================================

export default
  auditSlice.reducer;