// ============================================================================
// TITech Community Capital
// Enterprise Permission Route
// File: src/routes/PermissionRoute.jsx
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
  Loader2,
  ShieldX,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Constants
// ============================================================================

export const PERMISSION_MODE = {
  ALL: "all",
  ANY: "any",
  NONE: "none",
};

// ============================================================================
// Loader
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
          Verifying permissions...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Unauthorized
// ============================================================================

function Unauthorized({
  title = "Permission Denied",
  message = "You do not have the required permissions to access this resource.",
}) {
  return (
    <div className="route-unauthorized-page">
      <div className="route-unauthorized-card">
        <ShieldX size={48} />

        <h2>{title}</h2>

        <p>{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Permission Helpers
// ============================================================================

function hasPermission(
  permission,
  userPermissions,
  checker
) {
  if (
    typeof checker ===
    "function"
  ) {
    return checker(
      permission
    );
  }

  return (
    userPermissions.includes(
      permission
    )
  );
}

function evaluatePermissions({
  permissions,
  mode,
  userPermissions,
  checker,
}) {
  if (
    !permissions ||
    permissions.length ===
      0
  ) {
    return true;
  }

  switch (mode) {
    case PERMISSION_MODE.ANY:
      return permissions.some(
        (permission) =>
          hasPermission(
            permission,
            userPermissions,
            checker
          )
      );

    case PERMISSION_MODE.NONE:
      return permissions.every(
        (permission) =>
          !hasPermission(
            permission,
            userPermissions,
            checker
          )
      );

    case PERMISSION_MODE.ALL:
    default:
      return permissions.every(
        (permission) =>
          hasPermission(
            permission,
            userPermissions,
            checker
          )
      );
  }
}

// ============================================================================
// Permission Route
// ============================================================================

function PermissionRoute({
  children,
  permissions = [],
  mode =
    PERMISSION_MODE.ALL,
  requireTenant = false,
  featureFlag = null,
  redirectTo = "/dashboard",
  fallback,
}) {
  const location =
    useLocation();

  const {
    user,
    loading,
    tenant,
    isAuthenticated,
    permissions:
      userPermissions = [],
    hasPermission:
      permissionChecker,
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
        to="/login"
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
      fallback || (
        <Unauthorized
          title="Tenant Required"
          message="This resource requires an active tenant."
        />
      )
    );
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
        : false;

    if (!enabled) {
      return (
        fallback || (
          <Unauthorized
            title="Feature Disabled"
            message="This feature is not enabled."
          />
        )
      );
    }
  }

  // ===========================================================================
  // Permission Validation
  // ===========================================================================

  const authorized =
    evaluatePermissions({
      permissions,
      mode,
      userPermissions,
      checker:
        permissionChecker,
    });

  if (!authorized) {
    return (
      fallback || (
        <Unauthorized />
      )
    );
  }

  // ===========================================================================
  // Audit
  // ===========================================================================

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "lastPermissionRoute",
        JSON.stringify({
          path:
            location.pathname,
          permissions,
          mode,
          timestamp:
            Date.now(),
        })
      );
    } catch {
      // Ignore storage failures
    }
  }, [
    location.pathname,
    permissions,
    mode,
  ]);

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
// Hook
// ============================================================================

export function usePermissions() {
  const {
    permissions = [],
    hasPermission:
      permissionChecker,
  } = useAuth();

  const can =
    (permission) =>
      hasPermission(
        permission,
        permissions,
        permissionChecker
      );

  const canAny =
    (required = []) =>
      required.some(
        (permission) =>
          can(
            permission
          )
      );

  const canAll =
    (required = []) =>
      required.every(
        (permission) =>
          can(
            permission
          )
      );

  const cannot =
    (permission) =>
      !can(
        permission
      );

  return {
    permissions,
    can,
    canAny,
    canAll,
    cannot,
  };
}

// ============================================================================
// HOC
// ============================================================================

export function withPermissionRoute(
  Component,
  options = {}
) {
  const Wrapped =
    (props) => (
      <PermissionRoute
        {...options}
      >
        <Component
          {...props}
        />
      </PermissionRoute>
    );

  Wrapped.displayName =
    `withPermissionRoute(${
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
  PermissionRoute
);