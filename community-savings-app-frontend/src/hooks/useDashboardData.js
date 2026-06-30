// ============================================================================
// TITech Community Capital
// Enterprise Dashboard Data Hook
// File: frontend/src/hooks/useDashboardData.js
// Production Grade
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import api from "../services/api";
import socket from "../services/socket";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_REFRESH_INTERVAL =
  60 * 1000;

const DEFAULT_STATE = {
  groups: [],
  stats: {
    savings: 0,
    members: 0,
    activeLoans: 0,
    totalDisbursed: 0,
    loans: [],
    fraud: [],
    mobileMoney: {},
    executive: {},
    regulatory: {},
  },
  notifications: [],
  systemHealth: {},
};

// ============================================================================
// Helpers
// ============================================================================

function normalizeArray(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  return [];
}

function normalizeObject(
  value
) {
  if (
    value &&
    typeof value ===
      "object"
  ) {
    return value;
  }

  return {};
}

function extractData(
  response
) {
  return (
    response?.data ??
    response ??
    null
  );
}

// ============================================================================
// Hook
// ============================================================================

export default function useDashboardData(
  options = {}
) {
  const {
    autoRefresh = true,
    refreshInterval =
      DEFAULT_REFRESH_INTERVAL,
    realtime = true,
    isAdmin = false,
    enableExecutive =
      false,
    enableFraud =
      false,
    enableRegulatory =
      false,
    enableMobileMoney =
      false,
  } = options;

  // ==========================================================================
  // State
  // ==========================================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    dashboard,
    setDashboard,
  ] = useState(
    DEFAULT_STATE
  );

  // ==========================================================================
  // Refs
  // ==========================================================================

  const mountedRef =
    useRef(false);

  const refreshRef =
    useRef();

  const requestRef =
    useRef(null);

  // ==========================================================================
  // Fetchers
  // ==========================================================================

  const fetchGroups =
    useCallback(
      async () => {
        const response =
          await api.get(
            "/api/groups"
          );

        return normalizeArray(
          extractData(
            response
          )
        );
      },
      []
    );

  const fetchStats =
    useCallback(
      async () => {
        if (!isAdmin) {
          return {};
        }

        const response =
          await api.get(
            "/api/admin/stats"
          );

        return normalizeObject(
          extractData(
            response
          )
        );
      },
      [isAdmin]
    );

  const fetchExecutive =
    useCallback(
      async () => {
        if (
          !enableExecutive
        ) {
          return {};
        }

        try {
          const response =
            await api.get(
              "/api/executive/dashboard"
            );

          return normalizeObject(
            extractData(
              response
            )
          );
        } catch {
          return {};
        }
      },
      [
        enableExecutive,
      ]
    );

  const fetchFraud =
    useCallback(
      async () => {
        if (
          !enableFraud
        ) {
          return [];
        }

        try {
          const response =
            await api.get(
              "/api/fraud/stats"
            );

          return normalizeArray(
            extractData(
              response
            )
          );
        } catch {
          return [];
        }
      },
      [enableFraud]
    );

  const fetchRegulatory =
    useCallback(
      async () => {
        if (
          !enableRegulatory
        ) {
          return {};
        }

        try {
          const response =
            await api.get(
              "/api/regulatory/dashboard"
            );

          return normalizeObject(
            extractData(
              response
            )
          );
        } catch {
          return {};
        }
      },
      [
        enableRegulatory,
      ]
    );

  const fetchMobileMoney =
    useCallback(
      async () => {
        if (
          !enableMobileMoney
        ) {
          return {};
        }

        try {
          const response =
            await api.get(
              "/api/mobile-money/dashboard"
            );

          return normalizeObject(
            extractData(
              response
            )
          );
        } catch {
          return {};
        }
      },
      [
        enableMobileMoney,
      ]
    );

  // ==========================================================================
  // Loader
  // ==========================================================================

  const loadDashboard =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (
            requestRef.current
          ) {
            return;
          }

          requestRef.current =
            true;

          if (
            !silent
          ) {
            setLoading(
              true
            );
          } else {
            setRefreshing(
              true
            );
          }

          setError(null);

          const [
            groups,
            stats,
            executive,
            fraud,
            regulatory,
            mobileMoney,
          ] =
            await Promise.all(
              [
                fetchGroups(),
                fetchStats(),
                fetchExecutive(),
                fetchFraud(),
                fetchRegulatory(),
                fetchMobileMoney(),
              ]
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setDashboard({
            groups,
            stats: {
              ...DEFAULT_STATE.stats,
              ...stats,
              executive,
              fraud,
              regulatory,
              mobileMoney,
            },
            notifications:
              dashboard.notifications,
            systemHealth:
              dashboard.systemHealth,
          });

          setLastUpdated(
            new Date()
          );
        } catch (
          err
        ) {
          console.error(
            err
          );

          if (
            mountedRef.current
          ) {
            setError(
              err
            );
          }
        } finally {
          requestRef.current =
            null;

          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        fetchGroups,
        fetchStats,
        fetchExecutive,
        fetchFraud,
        fetchRegulatory,
        fetchMobileMoney,
        dashboard.notifications,
        dashboard.systemHealth,
      ]
    );

  // ==========================================================================
  // Manual Refresh
  // ==========================================================================

  const refresh =
    useCallback(
      () =>
        loadDashboard(
          true
        ),
      [loadDashboard]
    );

  // ==========================================================================
  // Realtime Updates
  // ==========================================================================

  useEffect(() => {
    if (
      !realtime
    ) {
      return;
    }

    const updateStats =
      payload => {
        setDashboard(
          previous => ({
            ...previous,
            stats: {
              ...previous.stats,
              ...payload,
            },
          })
        );
      };

    const updateNotifications =
      payload => {
        setDashboard(
          previous => ({
            ...previous,
            notifications:
              [
                payload,
                ...previous.notifications,
              ].slice(
                0,
                50
              ),
          })
        );
      };

    const updateHealth =
      payload => {
        setDashboard(
          previous => ({
            ...previous,
            systemHealth:
              payload,
          })
        );
      };

    socket.on(
      "dashboard:update",
      updateStats
    );

    socket.on(
      "notification",
      updateNotifications
    );

    socket.on(
      "system:health",
      updateHealth
    );

    return () => {
      socket.off(
        "dashboard:update",
        updateStats
      );

      socket.off(
        "notification",
        updateNotifications
      );

      socket.off(
        "system:health",
        updateHealth
      );
    };
  }, [realtime]);

  // ==========================================================================
  // Initial Load
  // ==========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    loadDashboard();

    return () => {
      mountedRef.current =
        false;
    };
  }, [loadDashboard]);

  // ==========================================================================
  // Auto Refresh
  // ==========================================================================

  useEffect(() => {
    if (
      !autoRefresh
    ) {
      return;
    }

    refreshRef.current =
      setInterval(
        () =>
          loadDashboard(
            true
          ),
        refreshInterval
      );

    return () =>
      clearInterval(
        refreshRef.current
      );
  }, [
    autoRefresh,
    refreshInterval,
    loadDashboard,
  ]);

  // ==========================================================================
  // Memoized Values
  // ==========================================================================

  const metrics =
    useMemo(
      () => ({
        totalGroups:
          dashboard.groups
            .length,

        totalMembers:
          dashboard.stats
            .members ||
          0,

        totalSavings:
          dashboard.stats
            .savings ||
          0,

        activeLoans:
          dashboard.stats
            .activeLoans ||
          0,

        totalDisbursed:
          dashboard.stats
            .totalDisbursed ||
          0,
      }),
      [dashboard]
    );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    loading,
    refreshing,
    error,
    lastUpdated,

    groups:
      dashboard.groups,

    stats:
      dashboard.stats,

    notifications:
      dashboard.notifications,

    systemHealth:
      dashboard.systemHealth,

    metrics,

    refresh,
    reload:
      loadDashboard,
  };
}