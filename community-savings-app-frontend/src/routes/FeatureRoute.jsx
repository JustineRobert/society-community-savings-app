// ============================================================================
// TITech Community Capital
// Enterprise Feature Route
// File: src/routes/FeatureRoute.jsx
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
  FlaskConical,
  Loader2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

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
          Loading feature...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Feature Disabled Component
// ============================================================================

function FeatureUnavailable({
  title = "Feature Unavailable",
  message = "This feature is not enabled for your account.",
}) {
  return (
    <div className="route-unavailable-page">
      <div className="route-unavailable-card">
        <FlaskConical size={48} />

        <h2>{title}</h2>

        <p>{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Percentage Rollout
// ============================================================================

function isWithinRollout(
  seed,
  percentage
) {
  if (
    !percentage ||
    percentage >= 100
  ) {
    return true;
  }

  const value =
    String(seed || "")
      .split("")
      .reduce(
        (
          acc,
          char
        ) =>
          acc +
          char.charCodeAt(
            0
          ),
        0
      ) % 100;

  return value < percentage;
}

// ============================================================================
// Feature Route
// ============================================================================

function FeatureRoute({
  children,
  feature,
  fallback,
  redirectTo = "/dashboard",
  requireAuth = true,
  requireTenant = false,
  roles = [],
  permissions = [],
  rolloutPercentage = 100,
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
    requireAuth &&
    (!isAuthenticated ||
      !user)
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
        <FeatureUnavailable
          title="Tenant Required"
          message="This feature requires an active tenant."
        />
      )
    );
  }

  // ===========================================================================
  // Role Validation
  // ===========================================================================

  if (
    roles.length > 0
  ) {
    const allowed =
      roles.includes(
        user?.role
      );

    if (!allowed) {
      return (
        <Navigate
          to={
            redirectTo
          }
          replace
        />
      );
    }
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
        <Navigate
          to={
            redirectTo
          }
          replace
        />
      );
    }
  }

  // ===========================================================================
  // Feature Flag Validation
  // ===========================================================================

  if (
    feature
  ) {
    const enabled =
      typeof hasFeature ===
      "function"
        ? hasFeature(
            feature
          )
        : false;

    if (!enabled) {
      return (
        fallback || (
          <FeatureUnavailable />
        )
      );
    }
  }

  // ===========================================================================
  // Percentage Rollout
  // ===========================================================================

  const rolloutSeed =
    user?.id ||
    user?._id ||
    tenant?.id ||
    tenant?._id;

  if (
    !isWithinRollout(
      rolloutSeed,
      rolloutPercentage
    )
  ) {
    return (
      fallback || (
        <FeatureUnavailable
          title="Coming Soon"
          message="This feature is gradually rolling out."
        />
      )
    );
  }

  // ===========================================================================
  // Audit Hook
  // ===========================================================================

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "lastFeatureRoute",
        JSON.stringify({
          path:
            location.pathname,
          feature,
          timestamp:
            Date.now(),
        })
      );
    } catch {
      // Ignore storage failures
    }
  }, [
    location.pathname,
    feature,
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

export function useFeatureAccess(
  feature
) {
  const {
    hasFeature,
  } = useAuth();

  return useMemo(() => {
    if (
      typeof hasFeature !==
      "function"
    ) {
      return false;
    }

    return hasFeature(
      feature
    );
  }, [
    feature,
    hasFeature,
  ]);
}

// ============================================================================
// HOC
// ============================================================================

export function withFeatureRoute(
  Component,
  options = {}
) {
  const Wrapped =
    (props) => (
      <FeatureRoute
        {...options}
      >
        <Component
          {...props}
        />
      </FeatureRoute>
    );

  Wrapped.displayName =
    `withFeatureRoute(${
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
  FeatureRoute
);