// ============================================================================
// File: frontend/src/components/AdminRoute.jsx
// TITech Community Capital – Enterprise Admin Route
// ============================================================================

import React, { memo, useMemo, useEffect, forwardRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DEFAULT_ADMIN_ROLES = Object.freeze(['admin']);
export const DEFAULT_REDIRECT = '/';
export const DEFAULT_UNAUTHORIZED = '/unauthorized';

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  DISABLED: 'disabled',
});

// ---------------------------------------------------------------------------
// Loading & Unauthorized Components
// ---------------------------------------------------------------------------
export const FullPageLoader = memo(() => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight: '100vh',
      fontSize: 15,
      fontWeight: 500,
      color: '#555',
    }}
  >
    Loading...
  </div>
));

export const Unauthorized = memo(() => (
  <div
    role="alert"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      textAlign: 'center',
      padding: 24,
    }}
  >
    <h2>Access Denied</h2>
    <p>You do not have permission to access this page.</p>
  </div>
));

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------
export const hasRequiredPermissions = (user, required = []) =>
  !required.length ||
  required.every((p) => (user?.permissions ?? []).includes(p));

export const hasRequiredRole = (user, roles = DEFAULT_ADMIN_ROLES) =>
  !roles.length || roles.includes(user?.role);

export const hasFeatureFlags = (user, flags = []) =>
  !flags.length || flags.every((f) => (user?.featureFlags ?? []).includes(f));

export const hasTenantAccess = (user, tenantId) => {
  if (!tenantId) return true;
  const userTenant = user?.tenantId ?? user?.organisationId ?? user?.organizationId;
  return typeof tenantId === 'function' ? tenantId(user) : userTenant === tenantId;
};

export const isAccountActive = (user) => {
  const status = user?.status ?? ACCOUNT_STATUS.ACTIVE;
  return status !== ACCOUNT_STATUS.SUSPENDED && status !== ACCOUNT_STATUS.DISABLED;
};

export const isSessionExpired = (user) => {
  const expiry = user?.expiresAt ?? user?.accessTokenExpiresAt ?? user?.sessionExpiresAt;
  return expiry ? Date.now() > new Date(expiry).getTime() : false;
};

export const isAuthorized = ({ user, roles, permissions, featureFlags, tenantId }) =>
  hasRequiredRole(user, roles) &&
  hasRequiredPermissions(user, permissions) &&
  hasFeatureFlags(user, featureFlags) &&
  hasTenantAccess(user, tenantId) &&
  isAccountActive(user) &&
  !isSessionExpired(user);

// ---------------------------------------------------------------------------
// Admin Route Component
// ---------------------------------------------------------------------------
const AdminRouteComponent = ({
  children,
  roles = DEFAULT_ADMIN_ROLES,
  permissions = [],
  featureFlags = [],
  tenantId,
  redirectTo = DEFAULT_REDIRECT,
  unauthorizedTo = DEFAULT_UNAUTHORIZED,
  LoadingComponent = FullPageLoader,
  UnauthorizedComponent,
  audit,
  onAuthorized,
  onUnauthorized,
  routeName = 'AdminRoute',
}) => {
  const location = useLocation();
  const { user, loading = false, initialized = true, isAuthenticated, logout } = useAuth?.() ?? {};

  if (!initialized || loading) return <LoadingComponent />;

  const authenticated = typeof isAuthenticated === 'boolean' ? isAuthenticated : Boolean(user);
  if (!authenticated) {
    return <Navigate replace to={redirectTo} state={{ from: location, reason: 'UNAUTHENTICATED' }} />;
  }

  if (isSessionExpired(user)) {
    logout?.();
    return <Navigate replace to={redirectTo} state={{ from: location, reason: 'SESSION_EXPIRED' }} />;
  }

  if (!isAccountActive(user)) {
    return <Navigate replace to={unauthorizedTo} state={{ from: location, reason: 'ACCOUNT_DISABLED' }} />;
  }

  const authorized = useMemo(
    () => isAuthorized({ user, roles, permissions, featureFlags, tenantId }),
    [user, roles, permissions, featureFlags, tenantId]
  );

  useEffect(() => {
    if (audit) {
      try {
        audit({
          route: routeName,
          authorized,
          user,
          pathname: location.pathname,
          timestamp: new Date().toISOString(),
        });
      } catch {}
    }
  }, [audit, authorized, user, routeName, location.pathname]);

  useEffect(() => {
    const cb = authorized ? onAuthorized : onUnauthorized;
    cb?.({ route: routeName, user });
  }, [authorized, onAuthorized, onUnauthorized, routeName, user]);

  if (!authorized) {
    return UnauthorizedComponent ? <UnauthorizedComponent /> : (
      <Navigate replace to={unauthorizedTo} state={{ from: location, reason: 'INSUFFICIENT_PRIVILEGES' }} />
    );
  }

  return children ?? <Outlet />;
};

export const AdminRoute = memo(AdminRouteComponent);

// ---------------------------------------------------------------------------
// Authorization Hook
// ---------------------------------------------------------------------------
export const useAuthorization = ({ roles = DEFAULT_ADMIN_ROLES, permissions = [], featureFlags = [], tenantId } = {}) => {
  const { user, loading = false, initialized = true, isAuthenticated } = useAuth?.() ?? {};
  const authenticated = useMemo(() => (typeof isAuthenticated === 'boolean' ? isAuthenticated : Boolean(user)), [isAuthenticated, user]);

  const authorized = useMemo(() => authenticated && isAuthorized({ user, roles, permissions, featureFlags, tenantId }), [
    authenticated,
    user,
    roles,
    permissions,
    featureFlags,
    tenantId,
  ]);

  return useMemo(() => ({ user, loading, initialized, authenticated, authorized }), [user, loading, initialized, authenticated, authorized]);
};

// ---------------------------------------------------------------------------
// Higher Order Component
// ---------------------------------------------------------------------------
export const withAdminRoute = (WrappedComponent, options = {}) => {
  const ComponentWithAdminRoute = memo(
    forwardRef((props, ref) => (
      <AdminRoute {...options}>
        <WrappedComponent {...props} ref={ref} />
      </AdminRoute>
    ))
  );
  ComponentWithAdminRoute.displayName = `withAdminRoute(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return ComponentWithAdminRoute;
};

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------
export default AdminRoute;
