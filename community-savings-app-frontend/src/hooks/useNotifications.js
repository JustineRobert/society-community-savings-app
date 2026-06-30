/**
 * ============================================================================
 * TITech Community Capital
 * Notifications Hook
 * File: frontend/src/hooks/useNotifications.js
 * Production Grade
 * ============================================================================
 *
 * Features
 * --------
 * ✓ Real-time Socket.IO notifications
 * ✓ Infinite Pagination
 * ✓ Browser Notifications
 * ✓ Toast Integration
 * ✓ Mark as Read
 * ✓ Mark All as Read
 * ✓ Delete Notifications
 * ✓ Unread Counter
 * ✓ Multi-tenant Ready
 * ✓ Retry Logic
 * ✓ Auto Refresh
 * ✓ Request Cancellation
 * ✓ React 18 Compatible
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "react-toastify";

import api from "../services/api";
import socket from "../services/socket";

const DEFAULT_PAGE_SIZE = 20;
const AUTO_REFRESH_INTERVAL =
  60000;
const MAX_RETRIES = 3;

export const NOTIFICATION_TYPES = {
  SYSTEM: "system",
  MEMBER: "member",
  PAYMENT: "payment",
  SAVINGS: "savings",
  LOAN: "loan",
  FRAUD: "fraud",
  KYC: "kyc",
  AML: "aml",
  USSD: "ussd",
  MOBILE_MONEY: "mobile_money",
  EXECUTIVE: "executive",
  REPORT: "report",
};

export default function useNotifications(
  options = {}
) {
  const {
    pageSize =
      DEFAULT_PAGE_SIZE,
    autoRefresh = true,
    realtime = true,
    enableBrowserNotifications = true,
  } = options;

  const mountedRef =
    useRef(false);

  const refreshTimerRef =
    useRef();

  const abortControllerRef =
    useRef();

  const retryRef =
    useRef(0);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

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
    page,
    setPage,
  ] = useState(1);

  const [
    hasMore,
    setHasMore,
  ] = useState(true);

  // ===========================================================================
  // Browser Notifications
  // ===========================================================================

  const showBrowserNotification =
    useCallback(
      (
        notification
      ) => {
        if (
          !enableBrowserNotifications
        ) {
          return;
        }

        if (
          typeof Notification ===
            "undefined" ||
          Notification.permission !==
            "granted"
        ) {
          return;
        }

        try {
          new Notification(
            notification.title ||
              "TITech Notification",
            {
              body:
                notification.message,
              icon:
                notification.icon ||
                "/favicon.ico",
              tag:
                notification._id,
            }
          );
        } catch (_) {}
      },
      [
        enableBrowserNotifications,
      ]
    );

  // ===========================================================================
  // Fetch Notifications
  // ===========================================================================

  const fetchNotifications =
    useCallback(
      async ({
        reset = false,
        silent = false,
      } = {}) => {
        try {
          if (!silent) {
            setRefreshing(
              true
            );
          }

          setError(null);

          abortControllerRef.current?.abort();

          abortControllerRef.current =
            new AbortController();

          const currentPage =
            reset
              ? 1
              : page;

          const response =
            await api.get(
              "/api/notifications",
              {
                params:
                  {
                    page:
                      currentPage,
                    limit:
                      pageSize,
                  },
                signal:
                  abortControllerRef
                    .current
                    .signal,
              }
            );

          const payload =
            response.data ||
            {};

          const items =
            payload.notifications ||
            payload.data ||
            [];

          if (reset) {
            setNotifications(
              items
            );
            setPage(2);
          } else {
            setNotifications(
              (
                previous
              ) => [
                ...previous,
                ...items,
              ]
            );

            setPage(
              (
                previous
              ) =>
                previous +
                1
            );
          }

          setHasMore(
            items.length >=
              pageSize
          );

          retryRef.current = 0;
        } catch (
          err
        ) {
          if (
            err.name ===
            "CanceledError"
          ) {
            return;
          }

          const message =
            err?.response
              ?.data
              ?.message ||
            err.message ||
            "Failed to load notifications.";

          setError(
            message
          );

          if (
            retryRef.current <
            MAX_RETRIES
          ) {
            retryRef.current += 1;

            setTimeout(
              () =>
                fetchNotifications(
                  {
                    reset,
                    silent:
                      true,
                  }
                ),
              2000 *
                retryRef.current
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
            setRefreshing(
              false
            );
          }
        }
      },
      [page, pageSize]
    );

  // ===========================================================================
  // Refresh
  // ===========================================================================

  const refresh =
    useCallback(() => {
      return fetchNotifications(
        {
          reset: true,
        }
      );
    }, [
      fetchNotifications,
    ]);

  // ===========================================================================
  // Mark Read
  // ===========================================================================

  const markAsRead =
    useCallback(
      async (
        notificationId
      ) => {
        try {
          await api.patch(
            `/api/notifications/${notificationId}/read`
          );

          setNotifications(
            (
              previous
            ) =>
              previous.map(
                (
                  item
                ) =>
                  item._id ===
                  notificationId
                    ? {
                        ...item,
                        read:
                          true,
                        readAt:
                          new Date().toISOString(),
                      }
                    : item
              )
          );
        } catch (
          err
        ) {
          toast.error(
            "Unable to mark notification as read."
          );
        }
      },
      []
    );

  // ===========================================================================
  // Mark All
  // ===========================================================================

  const markAllAsRead =
    useCallback(
      async () => {
        try {
          await api.patch(
            "/api/notifications/read-all"
          );

          setNotifications(
            (
              previous
            ) =>
              previous.map(
                (
                  item
                ) => ({
                  ...item,
                  read:
                    true,
                  readAt:
                    new Date().toISOString(),
                })
              )
          );
        } catch {
          toast.error(
            "Failed to mark all notifications."
          );
        }
      },
      []
    );

  // ===========================================================================
  // Delete Notification
  // ===========================================================================

  const deleteNotification =
    useCallback(
      async (
        notificationId
      ) => {
        try {
          await api.delete(
            `/api/notifications/${notificationId}`
          );

          setNotifications(
            (
              previous
            ) =>
              previous.filter(
                (
                  item
                ) =>
                  item._id !==
                  notificationId
              )
          );
        } catch {
          toast.error(
            "Unable to delete notification."
          );
        }
      },
      []
    );

  // ===========================================================================
  // Delete All
  // ===========================================================================

  const clearNotifications =
    useCallback(
      async () => {
        try {
          await api.delete(
            "/api/notifications"
          );

          setNotifications(
            []
          );
        } catch {
          toast.error(
            "Failed to clear notifications."
          );
        }
      },
      []
    );

  // ===========================================================================
  // Realtime Notifications
  // ===========================================================================

  useEffect(() => {
    if (!realtime)
      return;

    const handleNotification =
      (
        notification
      ) => {
        setNotifications(
          (
            previous
          ) => [
            notification,
            ...previous,
          ]
        );

        showBrowserNotification(
          notification
        );

        if (
          notification.toast !==
          false
        ) {
          toast.info(
            notification.title ||
              notification.message
          );
        }
      };

    const handleRead =
      (
        notificationId
      ) => {
        setNotifications(
          (
            previous
          ) =>
            previous.map(
              (
                item
              ) =>
                item._id ===
                notificationId
                  ? {
                      ...item,
                      read:
                        true,
                    }
                  : item
            )
        );
      };

    socket.on(
      "notification",
      handleNotification
    );

    socket.on(
      "notification:read",
      handleRead
    );

    socket.on(
      "notification:new",
      handleNotification
    );

    return () => {
      socket.off(
        "notification",
        handleNotification
      );

      socket.off(
        "notification:new",
        handleNotification
      );

      socket.off(
        "notification:read",
        handleRead
      );
    };
  }, [
    realtime,
    showBrowserNotification,
  ]);

  // ===========================================================================
  // Notification Permission
  // ===========================================================================

  useEffect(() => {
    if (
      !enableBrowserNotifications
    ) {
      return;
    }

    if (
      typeof Notification ===
        "undefined" ||
      Notification.permission ===
        "granted" ||
      Notification.permission ===
        "denied"
    ) {
      return;
    }

    Notification.requestPermission().catch(
      () => {}
    );
  }, [
    enableBrowserNotifications,
  ]);

  // ===========================================================================
  // Initialize
  // ===========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    fetchNotifications({
      reset: true,
    });

    return () => {
      mountedRef.current =
        false;

      abortControllerRef.current?.abort();
    };
  }, []);

  // ===========================================================================
  // Auto Refresh
  // ===========================================================================

  useEffect(() => {
    if (
      !autoRefresh
    ) {
      return;
    }

    refreshTimerRef.current =
      setInterval(
        () =>
          fetchNotifications(
            {
              reset: true,
              silent:
                true,
            }
          ),
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      clearInterval(
        refreshTimerRef.current
      );
    };
  }, [
    autoRefresh,
    fetchNotifications,
  ]);

  // ===========================================================================
  // Computed Values
  // ===========================================================================

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (n) =>
            !n.read
        ).length,
      [notifications]
    );

  const groupedNotifications =
    useMemo(() => {
      return notifications.reduce(
        (
          accumulator,
          notification
        ) => {
          const type =
            notification.type ||
            "system";

          if (
            !accumulator[
              type
            ]
          ) {
            accumulator[
              type
            ] = [];
          }

          accumulator[
            type
          ].push(
            notification
          );

          return accumulator;
        },
        {}
      );
    }, [notifications]);

  // ===========================================================================
  // Export
  // ===========================================================================

  return {
    notifications,
    groupedNotifications,

    loading,
    refreshing,
    error,

    page,
    hasMore,
    unreadCount,

    refresh,
    fetchNotifications,

    markAsRead,
    markAllAsRead,

    deleteNotification,
    clearNotifications,

    setNotifications,
  };
}