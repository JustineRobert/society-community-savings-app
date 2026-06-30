// ============================================================================
// TITech Community Capital
// Enterprise Route Guards
// File: src/routes/RouteGuards.jsx
// Production Grade
// ============================================================================

import {
  useMemo,
} from "react";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Constants
// ============================================================================

export const GuardResult = {
  ALLOWED: "allowed",
  UNAUTHENTICATED:
    "unauthenticated",
  UNAUTHORIZED:
    "unauthorized",
  FEATURE_DISABLED:
    "feature_disabled",
  TENANT_REQUIRED:
    "tenant_required",
  SUBSCRIPTION_REQUIRED:
    "subscription_required",
  BRANCH_REQUIRED:
    "branch_required",
  SESSION_EXPIRED:
    "session_expired",
};

// ============================================================================
// Utilities
// ============================================================================

function normalizeArray(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  return [value];
}

function includesAny(
  source = [],
  values = []
) {
  return values.some(
    (v) =>
      source.includes(v)
  );
}

function includesAll(
  source = [],
  values = []
) {
  return values.every(
    (v) =>
      source.includes(v)
  );
}

// ============================================================================
// Authentication Guard
// ============================================================================

export function canAccessAuthenticated(
  auth
) {
  if (
    !auth?.isAuthenticated ||
    !auth?.user
  ) {
    return {
      allowed: false,
      reason:
        GuardResult.UNAUTHENTICATED,
    };
  }

  return {
    allowed: true,
    reason:
      GuardResult.ALLOWED,
  };
}

// ============================================================================
// Role Guard
// ============================================================================

export function canAccessRoles(
  auth,
  roles = []
) {
  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  const allowedRoles =
    normalizeArray(
      roles
    );

  if (
    allowedRoles.length ===
    0
  ) {
    return {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    };
  }

  const userRole =
    auth.user?.role;

  return {
    allowed:
      allowedRoles.includes(
        userRole
      ),
    reason:
      allowedRoles.includes(
        userRole
      )
        ? GuardResult.ALLOWED
        : GuardResult.UNAUTHORIZED,
  };
}

// ============================================================================
// Permission Guard
// ============================================================================

export function canAccessPermissions(
  auth,
  permissions = [],
  mode = "all"
) {
  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  const required =
    normalizeArray(
      permissions
    );

  if (
    required.length ===
    0
  ) {
    return {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    };
  }

  const userPermissions =
    auth.permissions ||
    [];

  let allowed =
    false;

  switch (mode) {
    case "any":
      allowed =
        includesAny(
          userPermissions,
          required
        );
      break;

    case "none":
      allowed =
        !includesAny(
          userPermissions,
          required
        );
      break;

    case "all":
    default:
      allowed =
        includesAll(
          userPermissions,
          required
        );
  }

  return {
    allowed,
    reason:
      allowed
        ? GuardResult.ALLOWED
        : GuardResult.UNAUTHORIZED,
  };
}

// ============================================================================
// Tenant Guard
// ============================================================================

export function canAccessTenant(
  auth,
  options = {}
) {
  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  const {
    requireActive =
      true,
  } = options;

  if (
    !auth.tenant
  ) {
    return {
      allowed: false,
      reason:
        GuardResult.TENANT_REQUIRED,
    };
  }

  if (
    requireActive &&
    auth.tenant.status &&
    ![
      "active",
      "ACTIVE",
    ].includes(
      auth.tenant.status
    )
  ) {
    return {
      allowed: false,
      reason:
        GuardResult.TENANT_REQUIRED,
    };
  }

  return {
    allowed: true,
    reason:
      GuardResult.ALLOWED,
  };
}

// ============================================================================
// Feature Guard
// ============================================================================

export function canAccessFeature(
  auth,
  feature
) {
  if (!feature) {
    return {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    };
  }

  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  const enabled =
    typeof auth.hasFeature ===
    "function"
      ? auth.hasFeature(
          feature
        )
      : false;

  return {
    allowed:
      enabled,
    reason:
      enabled
        ? GuardResult.ALLOWED
        : GuardResult.FEATURE_DISABLED,
  };
}

// ============================================================================
// Subscription Guard
// ============================================================================

export function canAccessSubscription(
  auth,
  requiredPlans = []
) {
  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  const plans =
    normalizeArray(
      requiredPlans
    );

  if (
    plans.length ===
    0
  ) {
    return {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    };
  }

  const currentPlan =
    auth.tenant?.plan ||
    auth.subscription;

  const allowed =
    plans.includes(
      currentPlan
    );

  return {
    allowed,
    reason:
      allowed
        ? GuardResult.ALLOWED
        : GuardResult.SUBSCRIPTION_REQUIRED,
  };
}

// ============================================================================
// Branch Guard
// ============================================================================

export function canAccessBranch(
  auth,
  branchId
) {
  const result =
    canAccessAuthenticated(
      auth
    );

  if (!result.allowed) {
    return result;
  }

  if (
    !branchId
  ) {
    return {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    };
  }

  const branches =
    auth.user
      ?.branches || [];

  const allowed =
    branches.some(
      (b) =>
        b.id ===
          branchId ||
        b._id ===
          branchId
    );

  return {
    allowed,
    reason:
      allowed
        ? GuardResult.ALLOWED
        : GuardResult.BRANCH_REQUIRED,
  };
}

// ============================================================================
// Composite Guard
// ============================================================================

export function evaluateRouteAccess(
  auth,
  options = {}
) {
  const {
    roles,
    permissions,
    permissionMode =
      "all",
    feature,
    tenant,
    subscription,
    branchId,
  } = options;

  const checks = [
    canAccessAuthenticated(
      auth
    ),
    canAccessRoles(
      auth,
      roles
    ),
    canAccessPermissions(
      auth,
      permissions,
      permissionMode
    ),
    canAccessFeature(
      auth,
      feature
    ),
    tenant
      ? canAccessTenant(
          auth
        )
      : {
          allowed:
            true,
        },
    canAccessSubscription(
      auth,
      subscription
    ),
    canAccessBranch(
      auth,
      branchId
    ),
  ];

  const failed =
    checks.find(
      (c) =>
        !c.allowed
    );

  return (
    failed || {
      allowed: true,
      reason:
        GuardResult.ALLOWED,
    }
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useRouteGuards() {
  const auth =
    useAuth();

  return useMemo(
    () => ({
      auth,
      canAccessAuthenticated:
        () =>
          canAccessAuthenticated(
            auth
          ),

      canAccessRoles:
        (roles) =>
          canAccessRoles(
            auth,
            roles
          ),

      canAccessPermissions:
        (
          permissions,
          mode
        ) =>
          canAccessPermissions(
            auth,
            permissions,
            mode
          ),

      canAccessFeature:
        (
          feature
        ) =>
          canAccessFeature(
            auth,
            feature
          ),

      canAccessTenant:
        (
          options
        ) =>
          canAccessTenant(
            auth,
            options
          ),

      canAccessSubscription:
        (
          plans
        ) =>
          canAccessSubscription(
            auth,
            plans
          ),

      canAccessBranch:
        (
          branchId
        ) =>
          canAccessBranch(
            auth,
            branchId
          ),

      evaluate:
        (
          options
        ) =>
          evaluateRouteAccess(
            auth,
            options
          ),
    }),
    [auth]
  );
}

// ============================================================================
// HOC
// ============================================================================

export function withRouteGuard(
  Component,
  evaluator
) {
  function Guarded(
    props
  ) {
    const auth =
      useAuth();

    const result =
      evaluator(
        auth
      );

    if (
      !result.allowed
    ) {
      return null;
    }

    return (
      <Component
        {...props}
      />
    );
  }

  Guarded.displayName =
    `withRouteGuard(${
      Component.displayName ||
      Component.name ||
      "Component"
    })`;

  return Guarded;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  GuardResult,
  canAccessAuthenticated,
  canAccessRoles,
  canAccessPermissions,
  canAccessTenant,
  canAccessFeature,
  canAccessSubscription,
  canAccessBranch,
  evaluateRouteAccess,
  useRouteGuards,
  withRouteGuard,
};