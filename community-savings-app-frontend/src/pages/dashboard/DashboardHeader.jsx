// ============================================================================
// TITech Community Capital
// Enterprise Dashboard Header
// File: frontend/src/pages/dashboard/DashboardHeader.jsx
// Production Grade
// ============================================================================

import React, {
  memo,
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  User,
  Wifi,
  WifiOff,
  ChevronDown,
  Moon,
  Sun,
  Building2,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../context/AuthContext";
import useRealtimeDashboard from "../../hooks/useRealtimeDashboard";

import {
  Button,
  SearchBox,
  NotificationBell,
  TenantSwitcher,
} from "../../ui";

import "./DashboardHeader.css";

// ============================================================================
// Helpers
// ============================================================================

function formatGreeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 18) {
    return "Good Afternoon";
  }

  return "Good Evening";
}

// ============================================================================
// Dashboard Header
// ============================================================================

function DashboardHeader({
  title = "Dashboard",
  subtitle,
  notificationCount = 0,
  loading = false,
  onRefresh,
  onSearch,
  onToggleSidebar,
  showSearch = true,
  showTenantSwitcher = true,
  showRefresh = true,
  showNotifications = true,
  showSettings = true,
  showThemeToggle = true,
  showLogout = true,
  className = "",
}) {
  const navigate =
    useNavigate();

  const {
    user,
    tenant,
    logout,
    switchTenant,
  } = useAuth();

  const realtime =
    useRealtimeDashboard({
      autoConnect: false,
    });

  const [
    darkMode,
    setDarkMode,
  ] = useState(
    document.documentElement.classList.contains(
      "dark"
    )
  );

  const [
    userMenuOpen,
    setUserMenuOpen,
  ] = useState(false);

  // ==========================================================================
  // Greeting
  // ==========================================================================

  const greeting =
    useMemo(
      () =>
        `${formatGreeting()}, ${
          user?.firstName ||
          user?.name ||
          "User"
        }`,
      [user]
    );

  // ==========================================================================
  // Search
  // ==========================================================================

  const handleSearch =
    useCallback(
      value => {
        onSearch?.(value);
      },
      [onSearch]
    );

  // ==========================================================================
  // Refresh
  // ==========================================================================

  const handleRefresh =
    useCallback(async () => {
      try {
        await onRefresh?.();

        toast.success(
          "Dashboard refreshed."
        );
      } catch {
        toast.error(
          "Unable to refresh dashboard."
        );
      }
    }, [onRefresh]);

  // ==========================================================================
  // Logout
  // ==========================================================================

  const handleLogout =
    useCallback(async () => {
      try {
        await logout();

        navigate(
          "/login",
          {
            replace: true,
          }
        );
      } catch {
        toast.error(
          "Logout failed."
        );
      }
    }, [logout, navigate]);

  // ==========================================================================
  // Theme
  // ==========================================================================

  const toggleTheme =
    useCallback(() => {
      document.documentElement.classList.toggle(
        "dark"
      );

      const enabled =
        document.documentElement.classList.contains(
          "dark"
        );

      setDarkMode(
        enabled
      );

      localStorage.setItem(
        "theme",
        enabled
          ? "dark"
          : "light"
      );
    }, []);

  // ==========================================================================
  // Tenant Change
  // ==========================================================================

  const handleTenantChange =
    useCallback(
      async tenantId => {
        try {
          await switchTenant?.(
            tenantId
          );

          toast.success(
            "Tenant switched successfully."
          );
        } catch {
          toast.error(
            "Unable to switch tenant."
          );
        }
      },
      [switchTenant]
    );

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <header
      className={`dashboard-header ${className}`}
    >
      {/* ================================================================ */}
      {/* Left */}
      {/* ================================================================ */}

      <div className="dashboard-header-left">
        <Button
          variant="ghost"
          onClick={
            onToggleSidebar
          }
          aria-label="Toggle Sidebar"
        >
          <Menu
            size={20}
          />
        </Button>

        <div className="dashboard-header-title">
          <h1>{title}</h1>

          <p>
            {subtitle ||
              greeting}
          </p>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Center */}
      {/* ================================================================ */}

      {showSearch && (
        <div className="dashboard-header-search">
          {SearchBox ? (
            <SearchBox
              placeholder="Search groups, members, loans..."
              onSearch={
                handleSearch
              }
            />
          ) : (
            <div className="dashboard-search-fallback">
              <Search
                size={18}
              />
              <input
                type="text"
                placeholder="Search..."
                onChange={e =>
                  handleSearch(
                    e.target
                      .value
                  )
                }
              />
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Right */}
      {/* ================================================================ */}

      <div className="dashboard-header-actions">
        {/* Tenant */}

        {showTenantSwitcher &&
          tenant && (
            <div className="dashboard-tenant">
              {TenantSwitcher ? (
                <TenantSwitcher
                  tenant={
                    tenant
                  }
                  onChange={
                    handleTenantChange
                  }
                />
              ) : (
                <>
                  <Building2
                    size={18}
                  />

                  <span>
                    {
                      tenant.name
                    }
                  </span>
                </>
              )}
            </div>
          )}

        {/* Connectivity */}

        <Button
          variant="ghost"
          title={
            realtime.connected
              ? "Connected"
              : "Disconnected"
          }
        >
          {realtime.connected ? (
            <Wifi
              size={18}
            />
          ) : (
            <WifiOff
              size={18}
            />
          )}
        </Button>

        {/* Refresh */}

        {showRefresh && (
          <Button
            variant="ghost"
            disabled={
              loading
            }
            onClick={
              handleRefresh
            }
          >
            <RefreshCw
              size={18}
              className={
                loading
                  ? "spin"
                  : ""
              }
            />
          </Button>
        )}

        {/* Notifications */}

        {showNotifications && (
          <>
            {NotificationBell ? (
              <NotificationBell
                count={
                  notificationCount
                }
              />
            ) : (
              <Button variant="ghost">
                <Bell
                  size={18}
                />

                {notificationCount >
                  0 && (
                  <span className="notification-badge">
                    {
                      notificationCount
                    }
                  </span>
                )}
              </Button>
            )}
          </>
        )}

        {/* Theme */}

        {showThemeToggle && (
          <Button
            variant="ghost"
            onClick={
              toggleTheme
            }
          >
            {darkMode ? (
              <Sun
                size={18}
              />
            ) : (
              <Moon
                size={18}
              />
            )}
          </Button>
        )}

        {/* Settings */}

        {showSettings && (
          <Button
            variant="ghost"
            onClick={() =>
              navigate(
                "/settings"
              )
            }
          >
            <Settings
              size={18}
            />
          </Button>
        )}

        {/* User Menu */}

        <div className="dashboard-user-menu">
          <Button
            variant="ghost"
            onClick={() =>
              setUserMenuOpen(
                p => !p
              )
            }
          >
            <User
              size={18}
            />

            <span>
              {user?.name ||
                "User"}
            </span>

            <ChevronDown
              size={16}
            />
          </Button>

          {userMenuOpen && (
            <div className="dashboard-user-dropdown">
              <button
                onClick={() =>
                  navigate(
                    "/profile"
                  )
                }
              >
                Profile
              </button>

              <button
                onClick={() =>
                  navigate(
                    "/account"
                  )
                }
              >
                Account
              </button>

              {showLogout && (
                <button
                  onClick={
                    handleLogout
                  }
                >
                  <LogOut
                    size={16}
                  />
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(
  DashboardHeader
);