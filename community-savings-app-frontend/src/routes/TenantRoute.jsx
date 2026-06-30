// ============================================================================
// TITech Community Capital
// Enterprise Tenant Route
// File: src/routes/TenantRoute.jsx
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
  useParams,
} from "react-router-dom";

import {
  Building2,
  Loader2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Loading
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
          Loading tenant...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Tenant Error
// ============================================================================

function TenantUnavailable({
  title = "Tenant Unavailable",
  message = "No tenant is available for this resource.",
}) {
  return (
    <div className="route-tenant-page">
      <div className="route-tenant-card">
        <Building2 size={48} />

        <h2>{title}</h2>

        <p>{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Tenant Route
// ============================================================================

function TenantRoute({
  children,
  redirectTo = "/dashboard",
  requireMembership = true,
  requireActiveTenant = true,
  fallback,
}) {
  const location =
    useLocation();

  const params =
    useParams();

  const {
    user,
    loading,
    isAuthenticated,
    tenant,
    tenants = [],
    switchTenant,
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
  // Tenant Required
  // ===========================================================================

  if (!tenant) {
    return (
      fallback || (
        <TenantUnavailable
          title="No Tenant"
          message="Your account is not associated with a tenant."
        />
      )
    );
  }

  // ===========================================================================
  // Tenant Status
  // ===========================================================================

  if (
    requireActiveTenant &&
    tenant.status &&
    ![
      "active",
      "ACTIVE",
    ].includes(
      tenant.status
    )
  ) {
    return (
      fallback || (
        <TenantUnavailable
          title="Tenant Disabled"
          message="This tenant is currently inactive."
        />
      )
    );
  }

  // ===========================================================================
  // Tenant Membership
  // ===========================================================================

  if (
    requireMembership &&
    Array.isArray(
      tenants
    ) &&
    tenants.length > 0
  ) {
    const member =
      tenants.some(
        (t) =>
          t.id ===
            tenant.id ||
          t._id ===
            tenant._id
      );

    if (!member) {
      return (
        fallback || (
          <TenantUnavailable
            title="Membership Required"
            message="You do not belong to this tenant."
          />
        )
      );
    }
  }

  // ===========================================================================
  // URL Tenant Validation
  // Example:
  // /tenant/:tenantId/dashboard
  // ===========================================================================

  const routeTenantId =
    params.tenantId;

  if (
    routeTenantId &&
    routeTenantId !==
      tenant.id &&
    routeTenantId !==
      tenant._id
  ) {
    const found =
      tenants.find(
        (t) =>
          t.id ===
            routeTenantId ||
          t._id ===
            routeTenantId
      );

    if (!found) {
      return (
        <Navigate
          to={
            redirectTo
          }
          replace
        />
      );
    }

    if (
      typeof switchTenant ===
      "function"
    ) {
      switchTenant(
        routeTenantId
      );
    }
  }

  // ===========================================================================
  // Audit Hook
  // ===========================================================================

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "lastTenantRoute",
        JSON.stringify({
          path:
            location.pathname,
          tenantId:
            tenant.id ||
            tenant._id,
          timestamp:
            Date.now(),
        })
      );
    } catch {
      // Ignore storage failures
    }
  }, [
    location.pathname,
    tenant,
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

export function useTenantAccess() {
  const {
    tenant,
    tenants = [],
    switchTenant,
  } = useAuth();

  const hasTenant =
    Boolean(
      tenant
    );

  const isActive =
    [
      "active",
      "ACTIVE",
      undefined,
    ].includes(
      tenant?.status
    );

  const belongsToTenant =
    (tenantId) =>
      tenants.some(
        (t) =>
          t.id ===
            tenantId ||
          t._id ===
            tenantId
      );

  return {
    tenant,
    tenants,
    hasTenant,
    isActive,
    belongsToTenant,
    switchTenant,
  };
}

// ============================================================================
// Higher Order Component
// ============================================================================

export function withTenantRoute(
  Component,
  options = {}
) {
  const Wrapped =
    (props) => (
      <TenantRoute
        {...options}
      >
        <Component
          {...props}
        />
      </TenantRoute>
    );

  Wrapped.displayName =
    `withTenantRoute(${
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
  TenantRoute
);