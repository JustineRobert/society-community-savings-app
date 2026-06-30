// ============================================================================
// TITech Community Capital
// Enterprise Admin Route
// File: src/routes/AdminRoute.jsx
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
  Lock,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ADMIN_ROLES = [
  "admin",
  "ADMIN",
  "super_admin",
  "SUPER_ADMIN",
];

// ============================================================================
// Loading Component
// ============================================================================

function RouteLoader() {
  return (
    <div className="route-loader-page">
      <div className="route-loader-card">
        <Loader2
          size={36}
          className="spin"
        />

        <p>
          Verifying access...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Unauthorized Component
// ============================================================================

function Unauthorized({
  title = "Access Denied",
  message = "You do not have permission to access this area.",
}) {
  return (
    <div className="route-unauthorized-page">
      <div className="route-unauthorized-card">
        <Lock size={48} />

        <h2>{title}</h2>

        <p>{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Route
// ============================================================================

function AdminRoute({
  children,
  roles = DEFAULT_ADMIN_ROLES,
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
  } = useAuth();

  // ===========================================================================
  // Loading
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
        <Unauthorized
          title="Tenant Required"
          message="No tenant context is available for your account."
        />
      )
    );
  }

  // ===========================================================================
  // Role Validation
  // ===========================================================================

  const roleAllowed =
    roles.includes(
      user?.role
    );

  if (!roleAllowed) {
    return (
      unauthorizedComponent || (
        <Unauthorized
          message="Administrator privileges are required."
        />
      )
    );
  }

  // ===========================================================================
  // Permission Validation
  // ===========================================================================

  if (
    permissions.length >
    0
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
          <Unauthorized
            title="Insufficient Permissions"
            message="Your administrator account lacks the required permissions."
          />
        )
      );
    }
  }

  // ===========================================================================
  // Feature Flag Validation
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
          <Unauthorized
            title="Feature Disabled"
            message="This feature is not enabled for your tenant."
          />
        )
      );
    }
  }

  // ===========================================================================
  // Diagnostics & Audit Hook
  // ===========================================================================

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "lastAdminRoute",
        location.pathname
      );
    } catch {
      // Ignore storage failures.
    }
  }, [location.pathname]);

  // ===========================================================================
  // Render
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
// Authorization Hook
// ============================================================================

export function useAdminAuthorization() {
  const {
    user,
    permissions = [],
    tenant,
    hasPermission,
    hasFeature,
  } = useAuth();

  const isAdmin =
    DEFAULT_ADMIN_ROLES.includes(
      user?.role
    );

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
    isAdmin,
    can,
    featureEnabled,
  };
}

// ============================================================================
// Higher Order Component
// ============================================================================

export function withAdminRoute(
  Component,
  options = {}
) {
  const Wrapped =
    (props) => (
      <AdminRoute
        {...options}
      >
        <Component
          {...props}
        />
      </AdminRoute>
    );

  Wrapped.displayName =
    `withAdminRoute(${
      Component.displayName ||
      Component.name ||
      "Component"
    })`;

  return Wrapped;
}

// ============================================================================
// Export
// ============================================================================

export default memo(
  AdminRoute
);