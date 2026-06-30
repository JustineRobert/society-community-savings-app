// ============================================================================
// TITech Community Capital
// Enterprise Permission Gate
// File: src/components/PermissionGate.jsx
// Production Grade
// Multi-Tenant | RBAC | ABAC | Enterprise Authorization
// ============================================================================

import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
} from "react";

import PropTypes from "prop-types";

// ============================================================================
// Permission Registry
// ============================================================================

export const PERMISSIONS = Object.freeze({
  VIEW_DASHBOARD:
    "dashboard.view",
  MANAGE_DASHBOARD:
    "dashboard.manage",

  VIEW_MEMBERS:
    "members.view",
  CREATE_MEMBER:
    "members.create",
  UPDATE_MEMBER:
    "members.update",
  DELETE_MEMBER:
    "members.delete",

  VIEW_SAVINGS:
    "savings.view",
  CREATE_SAVINGS:
    "savings.create",
  APPROVE_SAVINGS:
    "savings.approve",

  VIEW_LOANS:
    "loans.view",
  CREATE_LOAN:
    "loans.create",
  APPROVE_LOAN:
    "loans.approve",
  DISBURSE_LOAN:
    "loans.disburse",

  VIEW_TRANSACTIONS:
    "transactions.view",
  CREATE_TRANSACTION:
    "transactions.create",
  REVERSE_TRANSACTION:
    "transactions.reverse",

  VIEW_REPORTS:
    "reports.view",
  EXPORT_REPORTS:
    "reports.export",

  VIEW_BILLING:
    "billing.view",
  MANAGE_BILLING:
    "billing.manage",

  VIEW_KYC:
    "kyc.view",
  APPROVE_KYC:
    "kyc.approve",

  VIEW_AML:
    "aml.view",
  MANAGE_AML:
    "aml.manage",

  VIEW_USSD:
    "ussd.view",
  MANAGE_USSD:
    "ussd.manage",

  VIEW_MOBILE_MONEY:
    "mobile_money.view",
  MANAGE_MOBILE_MONEY:
    "mobile_money.manage",

  VIEW_EXECUTIVE_DASHBOARD:
    "executive_dashboard.view",

  VIEW_FRAUD:
    "fraud_detection.view",
  MANAGE_FRAUD:
    "fraud_detection.manage",

  VIEW_REGULATORY_REPORTING:
    "regulatory_reporting.view",

  MANAGE_TENANTS:
    "tenant_management.manage",

  MANAGE_USERS:
    "users.manage",

  API_ACCESS:
    "api.access",

  SUPER_ADMIN:
    "*",
});

// ============================================================================
// Roles
// ============================================================================

export const ROLES = Object.freeze({
  SUPER_ADMIN:
    "super_admin",
  PLATFORM_ADMIN:
    "platform_admin",
  TENANT_ADMIN:
    "tenant_admin",
  MANAGER: "manager",
  TELLER: "teller",
  COMPLIANCE:
    "compliance",
  AUDITOR: "auditor",
  MEMBER: "member",
  EXECUTIVE:
    "executive",
});

// ============================================================================
// Context
// ============================================================================

const PermissionContext =
  createContext({
    permissions: [],
    roles: [],
    user: null,
    tenantId: null,
    loading: false,
  });

// ============================================================================
// Provider
// ============================================================================

export function PermissionProvider({
  children,
  permissions = [],
  roles = [],
  user = null,
  tenantId = null,
  loading = false,
}) {
  const value =
    useMemo(
      () => ({
        permissions,
        roles,
        user,
        tenantId,
        loading,
      }),
      [
        permissions,
        roles,
        user,
        tenantId,
        loading,
      ]
    );

  return (
    <PermissionContext.Provider
      value={value}
    >
      {children}
    </PermissionContext.Provider>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function normalize(
  value
) {
  return String(value)
    .trim()
    .toLowerCase();
}

function toArray(
  value
) {
  if (!value) {
    return [];
  }

  return Array.isArray(
    value
  )
    ? value
    : [value];
}

// ============================================================================
// Hooks
// ============================================================================

export function usePermissionContext() {
  return useContext(
    PermissionContext
  );
}

export function usePermission(
  permission,
  permissions
) {
  const context =
    usePermissionContext();

  const available =
    permissions ||
    context.permissions;

  return useMemo(() => {
    const perms =
      available.map(
        normalize
      );

    return (
      perms.includes("*") ||
      perms.includes(
        normalize(
          permission
        )
      )
    );
  }, [
    permission,
    available,
  ]);
}

export function usePermissions(
  permissions,
  availablePermissions,
  options = {}
) {
  const context =
    usePermissionContext();

  const available =
    availablePermissions ||
    context.permissions;

  const requireAll =
    options.requireAll ===
    true;

  return useMemo(() => {
    const requested =
      toArray(
        permissions
      ).map(
        normalize
      );

    const perms =
      available.map(
        normalize
      );

    if (
      perms.includes("*")
    ) {
      return true;
    }

    if (
      requested.length ===
      0
    ) {
      return true;
    }

    if (requireAll) {
      return requested.every(
        p =>
          perms.includes(p)
      );
    }

    return requested.some(
      p =>
        perms.includes(p)
    );
  }, [
    permissions,
    available,
    requireAll,
  ]);
}

export function useRole(
  role,
  roles
) {
  const context =
    usePermissionContext();

  const available =
    roles ||
    context.roles;

  return useMemo(() => {
    return available
      .map(normalize)
      .includes(
        normalize(role)
      );
  }, [role, available]);
}

export function useRoles(
  roles,
  availableRoles,
  options = {}
) {
  const context =
    usePermissionContext();

  const available =
    availableRoles ||
    context.roles;

  const requireAll =
    options.requireAll ===
    true;

  return useMemo(() => {
    const requested =
      toArray(
        roles
      ).map(
        normalize
      );

    const userRoles =
      available.map(
        normalize
      );

    if (requireAll) {
      return requested.every(
        role =>
          userRoles.includes(
            role
          )
      );
    }

    return requested.some(
      role =>
        userRoles.includes(
          role
        )
    );
  }, [
    roles,
    available,
    requireAll,
  ]);
}

// ============================================================================
// Permission Gate
// ============================================================================

function PermissionGate({
  children,
  permissions,
  roles,
  requireAll = false,
  fallback = null,
  loadingComponent =
    null,
  invert = false,
  onAllow,
  onDeny,
  audit = false,
}) {
  const context =
    usePermissionContext();

  const previous =
    useRef(null);

  const permissionAccess =
    permissions
      ? usePermissions(
          permissions,
          null,
          {
            requireAll,
          }
        )
      : true;

  const roleAccess =
    roles
      ? useRoles(
          roles,
          null,
          {
            requireAll,
          }
        )
      : true;

  const allowed =
    permissionAccess &&
    roleAccess;

  const finalResult =
    invert
      ? !allowed
      : allowed;

  useEffect(() => {
    if (
      previous.current ===
      finalResult
    ) {
      return;
    }

    previous.current =
      finalResult;

    if (finalResult) {
      onAllow?.();
    } else {
      onDeny?.();
    }

    if (
      audit &&
      process.env
        .NODE_ENV !==
        "production"
    ) {
      console.debug(
        "[PermissionGate]",
        {
          permissions,
          roles,
          allowed:
            finalResult,
          tenantId:
            context.tenantId,
        }
      );
    }
  }, [
    finalResult,
    permissions,
    roles,
    onAllow,
    onDeny,
    audit,
    context.tenantId,
  ]);

  if (
    context.loading
  ) {
    return (
      loadingComponent ||
      null
    );
  }

  if (!finalResult) {
    return fallback;
  }

  return <>{children}</>;
}

// ============================================================================
// Utilities
// ============================================================================

PermissionGate.hasPermission =
  (
    permission,
    permissions = []
  ) => {
    const perms =
      permissions.map(
        normalize
      );

    return (
      perms.includes("*") ||
      perms.includes(
        normalize(
          permission
        )
      )
    );
  };

PermissionGate.hasRole =
  (
    role,
    roles = []
  ) => {
    return roles
      .map(normalize)
      .includes(
        normalize(role)
      );
  };

PermissionGate.hasAnyPermission =
  (
    permissions,
    userPermissions = []
  ) => {
    return toArray(
      permissions
    ).some(permission =>
      PermissionGate.hasPermission(
        permission,
        userPermissions
      )
    );
  };

PermissionGate.hasAllPermissions =
  (
    permissions,
    userPermissions = []
  ) => {
    return toArray(
      permissions
    ).every(permission =>
      PermissionGate.hasPermission(
        permission,
        userPermissions
      )
    );
  };

PermissionGate.filter =
  (
    items = [],
    key = "permission",
    permissions = []
  ) => {
    return items.filter(
      item =>
        !item[key] ||
        PermissionGate.hasPermission(
          item[key],
          permissions
        )
    );
  };

// ============================================================================
// Higher Order Component
// ============================================================================

export function withPermission(
  WrappedComponent,
  options = {}
) {
  function Component(
    props
  ) {
    return (
      <PermissionGate
        permissions={
          options.permissions
        }
        roles={
          options.roles
        }
        requireAll={
          options.requireAll
        }
        fallback={
          options.fallback
        }
      >
        <WrappedComponent
          {...props}
        />
      </PermissionGate>
    );
  }

  Component.displayName = `withPermission(${
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    "Component"
  })`;

  return Component;
}

// ============================================================================
// PropTypes
// ============================================================================

PermissionProvider.propTypes =
  {
    children:
      PropTypes.node
        .isRequired,
    permissions:
      PropTypes.array,
    roles:
      PropTypes.array,
    user:
      PropTypes.object,
    tenantId:
      PropTypes.string,
    loading:
      PropTypes.bool,
  };

PermissionGate.propTypes = {
  children:
    PropTypes.node,
  permissions:
    PropTypes.oneOfType(
      [
        PropTypes.string,
        PropTypes.arrayOf(
          PropTypes.string
        ),
      ]
    ),
  roles:
    PropTypes.oneOfType(
      [
        PropTypes.string,
        PropTypes.arrayOf(
          PropTypes.string
        ),
      ]
    ),
  requireAll:
    PropTypes.bool,
  fallback:
    PropTypes.node,
  loadingComponent:
    PropTypes.node,
  invert:
    PropTypes.bool,
  onAllow:
    PropTypes.func,
  onDeny:
    PropTypes.func,
  audit:
    PropTypes.bool,
};

// ============================================================================
// Exports
// ============================================================================

PermissionGate.registry =
  PERMISSIONS;

PermissionGate.roles =
  ROLES;

export default React.memo(
  PermissionGate
);