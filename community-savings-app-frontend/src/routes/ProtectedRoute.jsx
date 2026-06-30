// ============================================================================
// TITech Community Capital
// Enterprise Protected Route
// File: src/routes/ProtectedRoute.jsx
// Production Grade
// ============================================================================

import React, {
  memo,
  useEffect,
  useMemo,
} from "react";

import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  ShieldAlert,
  Loader2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Default Unauthorized Component
// ============================================================================

function Unauthorized({
  message,
}) {
  return (
    <div className="route-unauthorized-page">
      <div className="route-unauthorized-card">
        <ShieldAlert size={48} />

        <h2>
          Access Denied
        </h2>

        <p>
          {message}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Component
// ============================================================================

function RouteLoader() {
  return (
    <div className="route-loader-page">
      <div className="route-loader-card">
        <Loader2
          size={32}
          className="spin"
        />

        <p>
          Verifying session...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Protected Route
// ============================================================================

function ProtectedRoute({
  children,
  roles = [],
  permissions = [],
  featureFlag = null,
  requireTenant = false,
  redirectTo = "/login",
  unauthorizedComponent,
}) {
  const location =
    useLocation();

  const {
    user,
    loading,
    isAuthenticated,
    permissions:
      userPermissions = [],
    tenant,
    hasPermission,
    hasFeature,
    logout,
  } = useAuth();

  // ===========================================================================
  // Session Loading
  // ===========================================================================

  if (loading) {
    return (
      <RouteLoader />
    );
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  if (
    !isAuthenticated ||
    !user
  ) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{
          from:
            location,
        }}
      />
    );
  }

  // ===========================================================================
  // Tenant Validation
  // ===========================================================================

  if (
    requireTenant &&
    !tenant
  ) {
    return (
      unauthorizedComponent || (
        <Unauthorized message="No tenant is associated with your account." />
      )
    );
  }

  // ===========================================================================
  // Role Validation
  // ===========================================================================

  if (
    roles.length > 0
  ) {
    const hasRole =
      roles.includes(
        user?.role
      );

    if (!hasRole) {
      return (
        unauthorizedComponent || (
          <Unauthorized message="You do not have permission to access this page." />
        )
      );
    }
  }

  // ===========================================================================
  // Permission Validation
  // ===========================================================================

  if (
    permissions.length > 0
  ) {
    const allowed =
      permissions.every(
        (
          permission
        ) => {
          if (
            typeof hasPermission ===
            "function"
          ) {
            return hasPermission(
              permission
            );
          }

          return userPermissions.includes(
            permission
          );
        }
      );

    if (!allowed) {
      return (
        unauthorizedComponent || (
          <Unauthorized message="Your account lacks the required permissions." />
        )
      );
    }
  }

  // ===========================================================================
  // Feature Flags
  // ===========================================================================

  if (
    featureFlag
  ) {
    const enabled =
      typeof hasFeature ===
      "function"
        ? hasFeature(
            featureFlag
          )
        : true;

    if (!enabled) {
      return (
        unauthorizedComponent || (
          <Unauthorized message="This feature is not enabled for your account." />
        )
      );
    }
  }

  // ===========================================================================
  // Session Activity Tracking
  // ===========================================================================

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "lastProtectedRoute",
        location.pathname
      );
    } catch {
      // ignore storage failures
    }
  }, [location.pathname]);

  // ===========================================================================
  // Session Expiration Handling
  // ===========================================================================

  useEffect(() => {
    const handleUnauthorized =
      async (
        event
      ) => {
        if (
          event?.detail
            ?.reason ===
          "session_expired"
        ) {
          try {
            await logout?.();
          } catch {
            // ignore
          }
        }
      };

    window.addEventListener(
      "auth:expired",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "auth:expired",
        handleUnauthorized
      );
    };
  }, [logout]);

  // ===========================================================================
  // Memoized Children
  // ===========================================================================

  const content =
    useMemo(() => {
      if (children) {
        return children;
      }

      return <Outlet />;
    }, [children]);

  return content;
}

// ============================================================================
// Export
// ============================================================================

export default memo(
  ProtectedRoute
);

// ============================================================================
// Utility Hooks
// ============================================================================

export function useAuthorization() {
  const {
    user,
    permissions = [],
    hasPermission,
    hasFeature,
    tenant,
  } = useAuth();

  const can =
    (permission) => {
      if (
        typeof hasPermission ===
        "function"
      ) {
        return hasPermission(
          permission
        );
      }

      return permissions.includes(
        permission
      );
    };

  const hasRole =
    (role) =>
      user?.role === role;

  const hasAnyRole =
    (roles) =>
      roles.includes(
        user?.role
      );

  const featureEnabled =
    (flag) => {
      if (
        typeof hasFeature ===
        "function"
      ) {
        return hasFeature(
          flag
        );
      }

      return true;
    };

  return {
    user,
    tenant,
    can,
    hasRole,
    hasAnyRole,
    featureEnabled,
  };
}