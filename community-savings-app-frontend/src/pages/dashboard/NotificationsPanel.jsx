// ============================================================================
// TITech Community Capital
// Notifications Panel
// File: frontend/src/pages/NotificationsPanel.jsx
// Production Grade
// Real-time Notifications | Infinite Scroll | Multi-Tenant | Socket.IO Ready
// ============================================================================

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import PropTypes from "prop-types";
import {
  Bell,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Wallet,
  ShieldAlert,
  Users,
  Building2,
  Trash2,
  Check,
  RefreshCw,
  X,
} from "lucide-react";

import api from "../services/api";
import socket from "../services/socket";

import {
  Button,
  Card,
  LoadingScreen,
  EmptyState,
  StatusBadge,
} from "../ui";

import "./NotificationsPanel.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;

const NOTIFICATION_ICONS = {
  payment: CreditCard,
  savings: Wallet,
  fraud: ShieldAlert,
  member: Users,
  tenant: Building2,
  success: CheckCircle2,
  warning: AlertCircle,
  default: Bell,
};

// ============================================================================
// Helpers
// ============================================================================

function getNotificationIcon(
  type
) {
  return (
    NOTIFICATION_ICONS[
      type
    ] ||
    NOTIFICATION_ICONS
      .default
  );
}

function formatDate(
  date
) {
  if (!date)
    return "Unknown";

  try {
    return new Intl.DateTimeFormat(
      "en-UG",
      {
        dateStyle:
          "medium",
        timeStyle:
          "short",
      }
    ).format(
      new Date(date)
    );
  } catch {
    return "Unknown";
  }
}

// ============================================================================
// Notification Item
// ============================================================================

const NotificationItem =
  memo(
    ({
      notification,
      onRead,
      onDelete,
    }) => {
      const Icon =
        getNotificationIcon(
          notification.type
        );

      return (
        <Card
          className={`notification-card ${
            notification.read
              ? ""
              : "unread"
          }`}
        >
          <div className="notification-icon">
            <Icon
              size={22}
            />
          </div>

          <div className="notification-content">
            <div className="notification-header">
              <h4>
                {
                  notification.title
                }
              </h4>

              {!notification.read && (
                <StatusBadge status="info">
                  New
                </StatusBadge>
              )}
            </div>

            <p>
              {
                notification.message
              }
            </p>

            <small>
              {formatDate(
                notification.createdAt
              )}
            </small>
          </div>

          <div className="notification-actions">
            {!notification.read && (
              <button
                title="Mark as read"
                onClick={() =>
                  onRead(
                    notification
                  )
                }
              >
                <Check
                  size={18}
                />
              </button>
            )}

            <button
              title="Delete"
              onClick={() =>
                onDelete(
                  notification
                )
              }
            >
              <Trash2
                size={18}
              />
            </button>
          </div>
        </Card>
      );
    }
  );

// ============================================================================
// Main Component
// ============================================================================

function NotificationsPanel({
  open = true,
  onClose,
}) {
  const mountedRef =
    useRef(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    hasMore,
    setHasMore,
  ] = useState(true);

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
  ] = useState("");

  // ===========================================================================
  // Load Notifications
  // ===========================================================================

  const loadNotifications =
    useCallback(
      async (
        reset =
          false
      ) => {
        try {
          setError("");

          if (reset) {
            setRefreshing(
              true
            );
          }

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
                      PAGE_SIZE,
                  },
              }
            );

          const payload =
            response.data ||
            {};

          const items =
            payload.notifications ||
            payload.data ||
            [];

          if (
            reset
          ) {
            setNotifications(
              items
            );
            setPage(
              2
            );
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
              PAGE_SIZE
          );
        } catch (
          err
        ) {
          setError(
            err?.response
              ?.data
              ?.message ||
              "Failed to load notifications."
          );
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      [page]
    );

  // ===========================================================================
  // Initial Load
  // ===========================================================================

  useEffect(() => {
    mountedRef.current =
      true;

    loadNotifications(
      true
    );

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  // ===========================================================================
  // Realtime Notifications
  // ===========================================================================

  useEffect(() => {
    function handler(
      notification
    ) {
      setNotifications(
        (
          previous
        ) => [
          notification,
          ...previous,
        ]
      );
    }

    socket.on(
      "notification",
      handler
    );

    return () => {
      socket.off(
        "notification",
        handler
      );
    };
  }, []);

  // ===========================================================================
  // Actions
  // ===========================================================================

  const markAsRead =
    useCallback(
      async (
        notification
      ) => {
        try {
          await api.patch(
            `/api/notifications/${notification._id}/read`
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
                  notification._id
                    ? {
                        ...item,
                        read:
                          true,
                      }
                    : item
              )
          );
        } catch {}
      },
      []
    );

  const deleteNotification =
    useCallback(
      async (
        notification
      ) => {
        try {
          await api.delete(
            `/api/notifications/${notification._id}`
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
                  notification._id
              )
          );
        } catch {}
      },
      []
    );

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (n) =>
            !n.read
        ).length,
      [notifications]
    );

  // ===========================================================================
  // Closed
  // ===========================================================================

  if (!open)
    return null;

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="notifications-panel">
        <LoadingScreen />
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <aside className="notifications-panel">
      <header className="notifications-header">
        <div>
          <h2>
            Notifications
          </h2>

          <small>
            {
              unreadCount
            }{" "}
            unread
          </small>
        </div>

        <div className="notifications-header-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              loadNotifications(
                true
              )
            }
            disabled={
              refreshing
            }
          >
            <RefreshCw
              size={16}
            />
          </Button>

          {onClose && (
            <Button
              size="sm"
              variant="secondary"
              onClick={
                onClose
              }
            >
              <X
                size={16}
              />
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="notifications-error">
          <AlertCircle
            size={18}
          />

          <span>
            {error}
          </span>
        </div>
      )}

      {!notifications.length ? (
        <EmptyState
          title="No Notifications"
          description="You're all caught up."
        />
      ) : (
        <>
          <div className="notifications-list">
            {notifications.map(
              (
                notification
              ) => (
                <NotificationItem
                  key={
                    notification._id
                  }
                  notification={
                    notification
                  }
                  onRead={
                    markAsRead
                  }
                  onDelete={
                    deleteNotification
                  }
                />
              )
            )}
          </div>

          {hasMore && (
            <div className="notifications-footer">
              <Button
                variant="secondary"
                onClick={() =>
                  loadNotifications()
                }
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

// ============================================================================
// PropTypes
// ============================================================================

NotificationsPanel.propTypes =
  {
    open:
      PropTypes.bool,
    onClose:
      PropTypes.func,
  };

export default memo(
  NotificationsPanel
);