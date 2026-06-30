// ============================================================================
// TITech Community Capital
// Enterprise Realtime Dashboard Hook
// File: frontend/src/hooks/useRealtimeDashboard.js
// Production Grade
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import socket, {
  connectSocket,
  disconnectSocket,
  subscribe,
  unsubscribe,
  getSocketStatus,
} from "../services/socket";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_STATE = {
  connected: false,
  notifications: [],
  alerts: [],
  transactions: [],
  savings: [],
  loans: [],
  fraud: [],
  executive: {},
  regulatory: {},
  mobileMoney: {},
  systemHealth: {},
  presence: {},
  lastMessage: null,
  lastUpdated: null,
};

const MAX_ITEMS = 100;

// ============================================================================
// Helpers
// ============================================================================

function appendLimited(
  previous,
  item
) {
  return [
    item,
    ...previous,
  ].slice(0, MAX_ITEMS);
}

// ============================================================================
// Hook
// ============================================================================

export default function useRealtimeDashboard(
  options = {}
) {
  const {
    autoConnect = true,
    enableNotifications = true,
    enableTransactions = true,
    enableSavings = true,
    enableLoans = true,
    enableFraud = true,
    enableExecutive = true,
    enableRegulatory = true,
    enableMobileMoney = true,
    enablePresence = true,
    enableSystemHealth = true,
  } = options;

  const mountedRef =
    useRef(false);

  const listenersRef =
    useRef([]);

  const [
    state,
    setState,
  ] = useState(
    DEFAULT_STATE
  );

  // ===========================================================================
  // Generic State Updater
  // ===========================================================================

  const updateState =
    useCallback(
      (
        key,
        payload,
        append = false
      ) => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setState(
          previous => ({
            ...previous,

            [key]:
              append
                ? appendLimited(
                    previous[
                      key
                    ],
                    payload
                  )
                : payload,

            lastMessage:
              payload,

            lastUpdated:
              new Date(),

            connected:
              socket.connected,
          })
        );
      },
      []
    );

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  const connect =
    useCallback(() => {
      connectSocket();
    }, []);

  const disconnect =
    useCallback(() => {
      disconnectSocket();
    }, []);

  const reconnect =
    useCallback(() => {
      disconnectSocket();
      connectSocket();
    }, []);

  // ===========================================================================
  // Notifications
  // ===========================================================================

  const clearNotifications =
    useCallback(() => {
      setState(
        previous => ({
          ...previous,
          notifications:
            [],
        })
      );
    }, []);

  const clearAlerts =
    useCallback(() => {
      setState(
        previous => ({
          ...previous,
          alerts: [],
        })
      );
    }, []);

  // ===========================================================================
  // Initialization
  // ===========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    if (
      autoConnect
    ) {
      connectSocket();
    }

    setState(
      previous => ({
        ...previous,
        connected:
          socket.connected,
      })
    );

    return () => {
      mountedRef.current =
        false;

      listenersRef.current.forEach(
        ({
          event,
          handler,
        }) => {
          unsubscribe(
            event,
            handler
          );
        }
      );

      listenersRef.current =
        [];
    };
  }, [autoConnect]);

  // ===========================================================================
  // Event Registration Helper
  // ===========================================================================

  const register =
    useCallback(
      (
        event,
        handler
      ) => {
        subscribe(
          event,
          handler
        );

        listenersRef.current.push(
          {
            event,
            handler,
          }
        );
      },
      []
    );

  // ===========================================================================
  // Socket Events
  // ===========================================================================

  useEffect(() => {
    const onConnect =
      () =>
        updateState(
          "connected",
          true
        );

    const onDisconnect =
      () =>
        updateState(
          "connected",
          false
        );

    register(
      "connect",
      onConnect
    );

    register(
      "disconnect",
      onDisconnect
    );

    return () => {
      unsubscribe(
        "connect",
        onConnect
      );

      unsubscribe(
        "disconnect",
        onDisconnect
      );
    };
  }, [
    register,
    updateState,
  ]);

  // ===========================================================================
  // Notifications
  // ===========================================================================

  useEffect(() => {
    if (
      !enableNotifications
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "notifications",
          payload,
          true
        );

    const alertHandler =
      payload =>
        updateState(
          "alerts",
          payload,
          true
        );

    register(
      "notification",
      handler
    );

    register(
      "alert",
      alertHandler
    );

    return () => {
      unsubscribe(
        "notification",
        handler
      );

      unsubscribe(
        "alert",
        alertHandler
      );
    };
  }, [
    enableNotifications,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Transactions
  // ===========================================================================

  useEffect(() => {
    if (
      !enableTransactions
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "transactions",
          payload,
          true
        );

    register(
      "transaction:update",
      handler
    );

    return () =>
      unsubscribe(
        "transaction:update",
        handler
      );
  }, [
    enableTransactions,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Savings
  // ===========================================================================

  useEffect(() => {
    if (
      !enableSavings
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "savings",
          payload,
          true
        );

    register(
      "savings:update",
      handler
    );

    return () =>
      unsubscribe(
        "savings:update",
        handler
      );
  }, [
    enableSavings,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Loans
  // ===========================================================================

  useEffect(() => {
    if (
      !enableLoans
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "loans",
          payload,
          true
        );

    register(
      "loan:update",
      handler
    );

    return () =>
      unsubscribe(
        "loan:update",
        handler
      );
  }, [
    enableLoans,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Fraud Monitoring
  // ===========================================================================

  useEffect(() => {
    if (
      !enableFraud
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "fraud",
          payload,
          true
        );

    register(
      "fraud:update",
      handler
    );

    return () =>
      unsubscribe(
        "fraud:update",
        handler
      );
  }, [
    enableFraud,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Executive Dashboard
  // ===========================================================================

  useEffect(() => {
    if (
      !enableExecutive
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "executive",
          payload
        );

    register(
      "executive:update",
      handler
    );

    return () =>
      unsubscribe(
        "executive:update",
        handler
      );
  }, [
    enableExecutive,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Regulatory Dashboard
  // ===========================================================================

  useEffect(() => {
    if (
      !enableRegulatory
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "regulatory",
          payload
        );

    register(
      "regulatory:update",
      handler
    );

    return () =>
      unsubscribe(
        "regulatory:update",
        handler
      );
  }, [
    enableRegulatory,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Mobile Money Dashboard
  // ===========================================================================

  useEffect(() => {
    if (
      !enableMobileMoney
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "mobileMoney",
          payload
        );

    register(
      "mobile_money:update",
      handler
    );

    return () =>
      unsubscribe(
        "mobile_money:update",
        handler
      );
  }, [
    enableMobileMoney,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Presence
  // ===========================================================================

  useEffect(() => {
    if (
      !enablePresence
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "presence",
          payload
        );

    register(
      "presence:update",
      handler
    );

    return () =>
      unsubscribe(
        "presence:update",
        handler
      );
  }, [
    enablePresence,
    register,
    updateState,
  ]);

  // ===========================================================================
  // System Health
  // ===========================================================================

  useEffect(() => {
    if (
      !enableSystemHealth
    ) {
      return;
    }

    const handler =
      payload =>
        updateState(
          "systemHealth",
          payload
        );

    register(
      "system:health",
      handler
    );

    return () =>
      unsubscribe(
        "system:health",
        handler
      );
  }, [
    enableSystemHealth,
    register,
    updateState,
  ]);

  // ===========================================================================
  // Diagnostics
  // ===========================================================================

  const diagnostics =
    useMemo(
      () => ({
        socket:
          getSocketStatus(),
        connected:
          state.connected,
        lastUpdated:
          state.lastUpdated,
        notifications:
          state
            .notifications
            .length,
        alerts:
          state.alerts
            .length,
        transactions:
          state
            .transactions
            .length,
      }),
      [state]
    );

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    connected:
      state.connected,

    notifications:
      state.notifications,

    alerts:
      state.alerts,

    transactions:
      state.transactions,

    savings:
      state.savings,

    loans:
      state.loans,

    fraud:
      state.fraud,

    executive:
      state.executive,

    regulatory:
      state.regulatory,

    mobileMoney:
      state.mobileMoney,

    presence:
      state.presence,

    systemHealth:
      state.systemHealth,

    lastMessage:
      state.lastMessage,

    lastUpdated:
      state.lastUpdated,

    diagnostics,

    connect,
    disconnect,
    reconnect,

    clearNotifications,
    clearAlerts,
  };
}