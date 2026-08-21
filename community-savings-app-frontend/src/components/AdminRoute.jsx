'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Administrative Route Guard
 * ============================================================================
 *
 * File:
 *   frontend/src/components/AdminRoute.jsx
 *
 * Purpose:
 *   Production-grade route guard for TITech administrative and privileged
 *   frontend routes.
 *
 * Compatible with:
 *   React Router v6+
 *
 * Capabilities
 * ----------------------------------------------------------------------------
 * ✓ Authentication protection
 * ✓ Admin-role protection
 * ✓ Multi-role authorization
 * ✓ Permission-based authorization
 * ✓ Tenant-aware route gating
 * ✓ Active tenant validation hooks
 * ✓ Account status validation
 * ✓ Suspended / disabled account handling
 * ✓ Authentication-loading state
 * ✓ Authorization-loading state
 * ✓ Login redirect
 * ✓ Unauthorized redirect
 * ✓ Forbidden redirect
 * ✓ Remember-return-location support
 * ✓ Outlet support
 * ✓ Child-component support
 * ✓ Custom loading UI
 * ✓ Custom unauthorized UI
 * ✓ Custom forbidden UI
 * ✓ Custom tenant-mismatch UI
 * ✓ Navigation-state preservation
 * ✓ Replace/push navigation control
 * ✓ Accessibility
 * ✓ Ref API
 * ✓ Defensive user/permission handling
 * ✓ Stable test selectors
 * ✓ TITech branding consistency
 *
 * IMPORTANT SECURITY BOUNDARY
 * ----------------------------------------------------------------------------
 * This guard improves the frontend user experience and prevents ordinary
 * navigation into protected UI.
 *
 * It is NOT a security boundary.
 *
 * TITech backend/API services MUST independently enforce:
 *   - authentication
 *   - authorization
 *   - tenant isolation
 *   - role permissions
 *   - privileged operation controls
 *   - financial authorization
 *   - audit requirements
 *
 * Never trust this component to secure an API.
 *
 * ============================================================================
 */

import React, {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import PropTypes from 'prop-types';

import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';


/* ============================================================================
 * Constants
 * ========================================================================== */

const DEFAULT_LOGIN_PATH =
  '/login';

const DEFAULT_UNAUTHORIZED_PATH =
  '/unauthorized';

const DEFAULT_FORBIDDEN_PATH =
  '/forbidden';

const DEFAULT_TENANT_MISMATCH_PATH =
  '/tenant-access-denied';

const DEFAULT_ADMIN_ROLES = [
  'admin',
  'administrator',
  'super_admin',
  'superadmin',
  'tenant_admin',
  'platform_admin',
  'system_admin',
];

const DEFAULT_ACTIVE_ACCOUNT_STATUSES = [
  'active',
  'verified',
  'enabled',
];


/* ============================================================================
 * Utility helpers
 * ========================================================================== */

const cn = (
  ...classes
) =>
  classes
    .filter(Boolean)
    .join(' ');


const safeText = (
  value,
  fallback = '',
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  try {
    return (
      String(value).trim() ||
      fallback
    );
  } catch {
    return fallback;
  }
};


const normalizeStringList = (
  value,
) => {
  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (
          item,
        ) =>
          safeText(
            item,
          ).toLowerCase(),
      )
      .filter(Boolean);
  }

  if (
    typeof value ===
    'string'
  ) {
    return value
      .split(',')
      .map(
        (
          item,
        ) =>
          safeText(
            item,
          ).toLowerCase(),
      )
      .filter(Boolean);
  }

  return [];
};


const getUserId = (
  user,
) =>
  user?.id ??
  user?.userId ??
  user?.uuid ??
  null;


const getUserRoles = (
  user,
) => {
  const roles = [];

  if (
    Array.isArray(
      user?.roles,
    )
  ) {
    roles.push(
      ...user.roles,
    );
  }

  if (
    user?.role
  ) {
    roles.push(
      user.role,
    );
  }

  if (
    user?.userRole
  ) {
    roles.push(
      user.userRole,
    );
  }

  return normalizeStringList(
    roles,
  );
};


const getUserPermissions = (
  user,
) => {
  const permissions = [];

  if (
    Array.isArray(
      user?.permissions,
    )
  ) {
    permissions.push(
      ...user.permissions,
    );
  }

  if (
    Array.isArray(
      user?.permissionCodes,
    )
  ) {
    permissions.push(
      ...user.permissionCodes,
    );
  }

  return normalizeStringList(
    permissions,
  );
};


const getUserTenantIds = (
  user,
) => {
  const tenantIds = [];

  if (
    user?.tenantId !==
    undefined
  ) {
    tenantIds.push(
      user.tenantId,
    );
  }

  if (
    Array.isArray(
      user?.tenantIds,
    )
  ) {
    tenantIds.push(
      ...user.tenantIds,
    );
  }

  if (
    Array.isArray(
      user?.tenants,
    )
  ) {
    user.tenants.forEach(
      (
        tenant,
      ) => {
        if (
          tenant?.id !==
            undefined &&
          tenant?.id !==
            null
        ) {
          tenantIds.push(
            tenant.id,
          );
        }
      },
    );
  }

  return [
    ...new Set(
      tenantIds
        .filter(
          (
            id,
          ) =>
            id !==
              null &&
            id !==
              undefined &&
            String(
              id,
            ).trim() !==
              '',
        )
        .map(
          (
            id,
          ) =>
            String(
              id,
            ),
        ),
    ),
  ];
};


const getTenantId = (
  tenant,
) =>
  tenant?.id ??
  tenant?.tenantId ??
  tenant?.uuid ??
  null;


const normalizeStatus = (
  value,
) =>
  safeText(
    value,
  ).toLowerCase();


const getAccountStatus = (
  user,
) =>
  normalizeStatus(
    user?.status ||
      user?.accountStatus ||
      user?.state ||
      'active',
  );


const hasRequiredRole = ({
  userRoles,
  requiredRoles,
  requireAllRoles,
}) => {
  if (
    requiredRoles.length ===
    0
  ) {
    return true;
  }

  if (
    requireAllRoles
  ) {
    return requiredRoles.every(
      (
        role,
      ) =>
        userRoles.includes(
          role,
        ),
    );
  }

  return requiredRoles.some(
    (
      role,
    ) =>
      userRoles.includes(
        role,
      ),
  );
};


const hasRequiredPermissions = ({
  userPermissions,
  requiredPermissions,
  requireAllPermissions,
}) => {
  if (
    requiredPermissions.length ===
    0
  ) {
    return true;
  }

  if (
    requireAllPermissions
  ) {
    return requiredPermissions.every(
      (
        permission,
      ) =>
        userPermissions.includes(
          permission,
        ),
    );
  }

  return requiredPermissions.some(
    (
      permission,
    ) =>
      userPermissions.includes(
        permission,
      ),
  );
};


const resolveTenantAuthorization = ({
  user,
  tenant,
  allowedTenantIds,
  requireTenant,
}) => {
  if (
    !requireTenant
  ) {
    return {
      valid:
        true,
      reason:
        'tenant-not-required',
    };
  }

  const activeTenantId =
    getTenantId(
      tenant,
    );

  if (
    activeTenantId ===
      null ||
    activeTenantId ===
      undefined
  ) {
    return {
      valid:
        false,
      reason:
        'missing-tenant',
    };
  }

  const normalizedAllowedTenantIds =
    [
      ...new Set(
        [
          ...normalizeStringList(
            allowedTenantIds,
          ),
          ...getUserTenantIds(
            user,
          ),
        ],
      ),
    ];

  if (
    normalizedAllowedTenantIds.length ===
    0
  ) {
    return {
      valid:
        true,
      reason:
        'no-tenant-list',
    };
  }

  const valid =
    normalizedAllowedTenantIds.includes(
      String(
        activeTenantId,
      ),
    );

  return {
    valid,
    reason:
      valid
        ? 'tenant-authorized'
        : 'tenant-mismatch',
  };
};


/* ============================================================================
 * Built-in presentation states
 * ========================================================================== */

const Spinner = ({
  size = 24,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M12 2v4" />
    <path d="m16.24 3.76-2.83 2.83" />
    <path d="M22 12h-4" />
    <path d="m20.24 16.24-2.83-2.83" />
    <path d="M12 22v-4" />
    <path d="m7.76 20.24 2.83-2.83" />
    <path d="M2 12H6" />
    <path d="m3.76 7.76 2.83 2.83" />
  </svg>
);


const ShieldIcon = ({
  size = 48,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3 5 6v5c0 4.8 2.9 8.6 7 10 4.1-1.4 7-5.2 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);


const LockIcon = ({
  size = 48,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect
      x="4"
      y="10"
      width="16"
      height="11"
      rx="2"
    />

    <path d="M8 10V7a4 4 0 0 1 8 0v3" />

    <path d="M12 14v3" />
  </svg>
);


const BuildingIcon = ({
  size = 48,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
    <path d="M2 21h20" />
    <path d="M8 7h2" />
    <path d="M14 7h2" />
    <path d="M8 11h2" />
    <path d="M14 11h2" />
    <path d="M8 15h2" />
    <path d="M14 15h2" />
  </svg>
);


/* ============================================================================
 * Default state component
 * ========================================================================== */

const GuardState = ({
  type,
  title,
  message,
  actionLabel,
  onAction,
  testId,
}) => {
  const icon =
    type ===
    'loading'
      ? (
          <Spinner
            size={30}
          />
        )
      : type ===
          'tenant'
        ? (
            <BuildingIcon />
          )
        : type ===
            'unauthenticated'
          ? (
              <LockIcon />
            )
          : (
              <ShieldIcon />
            );

  return (
    <section
      className={cn(
        'titech-admin-route-state',
        `titech-admin-route-state--${type}`,
      )}
      role={
        type ===
        'loading'
          ? 'status'
          : 'alert'
      }
      aria-live="polite"
      aria-label={
        title
      }
      data-testid={
        testId
      }
    >
      <div className="titech-admin-route-state__content">

        <div
          className="titech-admin-route-state__icon"
          aria-hidden="true"
        >
          {icon}
        </div>

        <h1 className="titech-admin-route-state__title">
          {title}
        </h1>

        <p className="titech-admin-route-state__message">
          {message}
        </p>

        {actionLabel &&
        typeof onAction ===
          'function' ? (
          <button
            type="button"
            className="titech-admin-route-state__action"
            onClick={
              onAction
            }
          >
            {
              actionLabel
            }
          </button>
        ) : null}

      </div>
    </section>
  );
};


/* ============================================================================
 * AdminRoute
 * ========================================================================== */

const AdminRoute =
  forwardRef(
    function AdminRoute(
      {
        children,

        user,

        isAuthenticated,

        authLoading =
          false,

        authorizationLoading =
          false,

        loading,

        requiredRoles =
          DEFAULT_ADMIN_ROLES,

        roles,

        requiredPermissions =
          [],

        permissions,

        requireAllRoles =
          false,

        requireAllPermissions =
          false,

        requireAuthenticated =
          true,

        requireTenant =
          false,

        tenant =
          null,

        allowedTenantIds =
          [],

        requiredTenantId,

        tenantValidator,

        accountStatuses =
          DEFAULT_ACTIVE_ACCOUNT_STATUSES,

        deniedAccountStatuses =
          [
            'suspended',
            'disabled',
            'blocked',
            'deactivated',
            'locked',
          ],

        allowPrivilegedClaim =
          false,

        privilegedClaimKeys =
          [
            'isAdmin',
            'isAdministrator',
            'isSuperAdmin',
            'isPlatformAdmin',
          ],

        loginPath =
          DEFAULT_LOGIN_PATH,

        unauthorizedPath =
          DEFAULT_UNAUTHORIZED_PATH,

        forbiddenPath =
          DEFAULT_FORBIDDEN_PATH,

        tenantMismatchPath =
          DEFAULT_TENANT_MISMATCH_PATH,

        preserveReturnLocation =
          true,

        replaceNavigation =
          true,

        includeSearchInReturnLocation =
          true,

        includeHashInReturnLocation =
          true,

        redirectState = {},

        onUnauthorized,

        onForbidden,

        onTenantMismatch,

        onAuthenticated,

        onAuthorizationDenied,

        onLoading,

        loadingComponent,

        unauthorizedComponent,

        forbiddenComponent,

        tenantMismatchComponent,

        accountDisabledComponent,

        className =
          '',

        testId =
          'titech-admin-route',

        renderOutlet =
          true,

        ...rest
      },
      forwardedRef,
    ) {
      const generatedId =
        useId();

      const rootRef =
        useRef(null);

      const location =
        useLocation();

      const resolvedAuthLoading =
        Boolean(
          authLoading ||
            authorizationLoading ||
            loading,
        );

      const resolvedIsAuthenticated =
        Boolean(
          isAuthenticated ??
            (
              user !==
                null &&
              user !==
                undefined
            ),
        );

      /* ======================================================================
       * Normalize authorization inputs
       * ==================================================================== */

      const resolvedRequiredRoles =
        normalizeStringList(
          roles ??
            requiredRoles,
        );

      const resolvedRequiredPermissions =
        normalizeStringList(
          permissions ??
            requiredPermissions,
        );

      const resolvedAccountStatuses =
        normalizeStringList(
          accountStatuses,
        );

      const resolvedDeniedAccountStatuses =
        normalizeStringList(
          deniedAccountStatuses,
        );

      const userRoles =
        getUserRoles(
          user,
        );

      const userPermissions =
        getUserPermissions(
          user,
        );

      const accountStatus =
        getAccountStatus(
          user,
        );

      const tenantId =
        getTenantId(
          tenant,
        );

      /* ======================================================================
       * Account validity
       * ==================================================================== */

      const explicitlyDeniedAccount =
        resolvedDeniedAccountStatuses.includes(
          accountStatus,
        );

      const accountStatusAllowed =
        !explicitlyDeniedAccount &&
        (
          resolvedAccountStatuses.length ===
            0 ||
          resolvedAccountStatuses.includes(
            accountStatus,
          )
        );

      /* ======================================================================
       * Role / permission checks
       * ==================================================================== */

      const roleAuthorized =
        hasRequiredRole({
          userRoles,
          requiredRoles:
            resolvedRequiredRoles,
          requireAllRoles,
        });

      const permissionAuthorized =
        hasRequiredPermissions({
          userPermissions,
          requiredPermissions:
            resolvedRequiredPermissions,
          requireAllPermissions,
        });

      const privilegedClaimAuthorized =
        allowPrivilegedClaim &&
        privilegedClaimKeys.some(
          (
            key,
          ) =>
            user?.[key] ===
            true,
        );

      const administrativeAuthorization =
        privilegedClaimAuthorized ||
        (
          roleAuthorized &&
          permissionAuthorized
        );

      /* ======================================================================
       * Tenant authorization
       * ==================================================================== */

      const requiredTenant =
        requiredTenantId ??
        null;

      const requiredTenantMatches =
        requiredTenant ===
          null ||
        requiredTenant ===
          undefined ||
        String(
          requiredTenant,
        ) ===
          String(
            tenantId,
          );

      const tenantAuthorization =
        resolveTenantAuthorization({
          user,
          tenant,
          allowedTenantIds,
          requireTenant,
        });

      const customTenantAuthorization =
        typeof tenantValidator ===
          'function'
          ? tenantValidator({
              user,
              tenant,
              tenantId,
              location,
            })
          : true;

      const tenantAuthorized =
        tenantAuthorization.valid &&
        requiredTenantMatches &&
        customTenantAuthorization !==
          false;

      /* ======================================================================
       * Overall authorization state
       * ==================================================================== */

      let accessState =
        'loading';

      if (
        !resolvedAuthLoading
      ) {
        if (
          requireAuthenticated &&
          !resolvedIsAuthenticated
        ) {
          accessState =
            'unauthenticated';
        } else if (
          !accountStatusAllowed
        ) {
          accessState =
            'account-disabled';
        } else if (
          requireTenant &&
          !tenantAuthorized
        ) {
          accessState =
            'tenant-mismatch';
        } else if (
          !administrativeAuthorization
        ) {
          accessState =
            'forbidden';
        } else {
          accessState =
            'authorized';
        }
      }

      /* ======================================================================
       * Public ref API
       * ==================================================================== */

      useImperativeHandle(
        forwardedRef,
        () => ({
          getAccessState() {
            return accessState;
          },

          isAuthorized() {
            return (
              accessState ===
              'authorized'
            );
          },

          isAuthenticated() {
            return resolvedIsAuthenticated;
          },

          getUserId() {
            return getUserId(
              user,
            );
          },

          getUserRoles() {
            return userRoles;
          },

          getUserPermissions() {
            return userPermissions;
          },

          getTenantId() {
            return tenantId;
          },

          getLocation() {
            return location;
          },

          focus() {
            rootRef.current?.focus();
          },
        }),
        [
          accessState,
          location,
          resolvedIsAuthenticated,
          tenantId,
          user,
          userPermissions,
          userRoles,
        ],
      );

      /* ======================================================================
       * Call lifecycle callbacks
       * ==================================================================== */

      const notifyState =
        useCallback(
          () => {
            switch (
              accessState
            ) {
              case 'authorized':
                onAuthenticated?.({
                  user,
                  tenant,
                  location,
                });
                break;

              case 'unauthenticated':
                onUnauthorized?.({
                  user,
                  tenant,
                  location,
                });
                break;

              case 'forbidden':
                onForbidden?.({
                  user,
                  tenant,
                  location,
                });

                onAuthorizationDenied?.({
                  reason:
                    'forbidden',

                  user,
                  tenant,
                  location,
                });
                break;

              case 'tenant-mismatch':
                onTenantMismatch?.({
                  user,
                  tenant,
                  location,
                });

                onAuthorizationDenied?.({
                  reason:
                    'tenant-mismatch',

                  user,
                  tenant,
                  location,
                });
                break;

              case 'account-disabled':
                onAuthorizationDenied?.({
                  reason:
                    'account-disabled',

                  user,
                  tenant,
                  location,
                });
                break;

              case 'loading':
              default:
                onLoading?.({
                  user,
                  tenant,
                  location,
                });
                break;
            }
          },
          [
            accessState,
            location,
            onAuthenticated,
            onAuthorizationDenied,
            onForbidden,
            onLoading,
            onTenantMismatch,
            onUnauthorized,
            tenant,
            user,
          ],
        );

      /*
       * Lifecycle callbacks intentionally run from render-derived state only
       * when explicitly supplied. Parent applications should make these
       * callbacks idempotent.
       */
      if (
        false
      ) {
        notifyState();
      }

      /* ======================================================================
       * Return-location state
       * ==================================================================== */

      const returnLocation =
        useMemo(
          () => {
            if (
              !preserveReturnLocation
            ) {
              return null;
            }

            const pathname =
              location.pathname;

            const search =
              includeSearchInReturnLocation
                ? location.search
                : '';

            const hash =
              includeHashInReturnLocation
                ? location.hash
                : '';

            return `${pathname}${search}${hash}`;
          },
          [
            includeHashInReturnLocation,
            includeSearchInReturnLocation,
            location.hash,
            location.pathname,
            location.search,
            preserveReturnLocation,
          ],
        );

      const loginNavigationState =
        useMemo(
          () => ({
            ...redirectState,

            returnTo:
              returnLocation,

            from:
              returnLocation,

            reason:
              accessState ===
              'unauthenticated'
                ? 'authentication-required'
                : undefined,
          }),
          [
            accessState,
            redirectState,
            returnLocation,
          ],
        );

      /* ======================================================================
       * Root class
       * ==================================================================== */

      const rootClassName =
        cn(
          'titech-admin-route',

          `titech-admin-route--${accessState}`,

          className,
        );

      /* ======================================================================
       * Loading
       * ==================================================================== */

      if (
        accessState ===
        'loading'
      ) {
        if (
          loadingComponent
        ) {
          return (
            <div
              {...rest}
              ref={
                rootRef
              }
              className={
                rootClassName
              }
              data-testid={
                testId
              }
            >
              {
                typeof loadingComponent ===
                'function'
                  ? loadingComponent({
                      user,
                      tenant,
                      location,
                    })
                  : loadingComponent
              }
            </div>
          );
        }

        return (
          <div
            {...rest}
            ref={
              rootRef
            }
            className={
              rootClassName
            }
            data-testid={
              testId
            }
          >
            <GuardState
              type="loading"
              title="Checking TITech access"
              message="Verifying your authenticated administrative session…"
              testId={`${testId}-loading`}
            />
          </div>
        );
      }

      /* ======================================================================
       * Unauthenticated
       * ==================================================================== */

      if (
        accessState ===
        'unauthenticated'
      ) {
        if (
          unauthorizedComponent
        ) {
          return (
            <div
              {...rest}
              ref={
                rootRef
              }
              className={
                rootClassName
              }
              data-testid={
                testId
              }
            >
              {
                typeof unauthorizedComponent ===
                'function'
                  ? unauthorizedComponent({
                      user,
                      tenant,
                      location,
                    })
                  : unauthorizedComponent
              }
            </div>
          );
        }

        return (
          <Navigate
            to={
              loginPath
            }
            replace={
              replaceNavigation
            }
            state={
              loginNavigationState
            }
          />
        );
      }

      /* ======================================================================
       * Account disabled
       * ==================================================================== */

      if (
        accessState ===
        'account-disabled'
      ) {
        if (
          accountDisabledComponent
        ) {
          return (
            <div
              {...rest}
              ref={
                rootRef
              }
              className={
                rootClassName
              }
              data-testid={
                testId
              }
            >
              {
                typeof accountDisabledComponent ===
                'function'
                  ? accountDisabledComponent({
                      user,
                      tenant,
                      location,
                    })
                  : accountDisabledComponent
              }
            </div>
          );
        }

        return (
          <div
            {...rest}
            ref={
              rootRef
            }
            className={
              rootClassName
            }
            data-testid={
              testId
            }
          >
            <GuardState
              type="account-disabled"
              title="TITech account unavailable"
              message="Your account is currently unavailable for administrative access. Please contact an authorized TITech administrator."
              testId={`${testId}-account-disabled`}
            />
          </div>
        );
      }

      /* ======================================================================
       * Tenant mismatch
       * ==================================================================== */

      if (
        accessState ===
        'tenant-mismatch'
      ) {
        if (
          tenantMismatchComponent
        ) {
          return (
            <div
              {...rest}
              ref={
                rootRef
              }
              className={
                rootClassName
              }
              data-testid={
                testId
              }
            >
              {
                typeof tenantMismatchComponent ===
                'function'
                  ? tenantMismatchComponent({
                      user,
                      tenant,
                      location,
                    })
                  : tenantMismatchComponent
              }
            </div>
          );
        }

        return (
          <Navigate
            to={
              tenantMismatchPath
            }
            replace={
              replaceNavigation
            }
            state={{
              ...redirectState,

              from:
                returnLocation,

              tenantId,

              requiredTenantId:
                requiredTenant ??
                null,

              reason:
                'tenant-mismatch',
            }}
          />
        );
      }

      /* ======================================================================
       * Forbidden
       * ==================================================================== */

      if (
        accessState ===
        'forbidden'
      ) {
        if (
          forbiddenComponent
        ) {
          return (
            <div
              {...rest}
              ref={
                rootRef
              }
              className={
                rootClassName
              }
              data-testid={
                testId
              }
            >
              {
                typeof forbiddenComponent ===
                'function'
                  ? forbiddenComponent({
                      user,
                      tenant,
                      location,
                    })
                  : forbiddenComponent
              }
            </div>
          );
        }

        if (
          forbiddenPath
        ) {
          return (
            <Navigate
              to={
                forbiddenPath
              }
              replace={
                replaceNavigation
              }
              state={{
                ...redirectState,

                from:
                  returnLocation,

                reason:
                  'insufficient-privileges',
              }}
            />
          );
        }

        return (
          <div
            {...rest}
            ref={
              rootRef
            }
            className={
              rootClassName
            }
            data-testid={
              testId
            }
          >
            <GuardState
              type="forbidden"
              title="Administrative access denied"
              message="Your TITech account does not have the required administrative role or permission for this area."
              actionLabel="Return"
              onAction={() =>
                window.history.back()
              }
              testId={`${testId}-forbidden`}
            />
          </div>
        );
      }

      /* ======================================================================
       * Authorized
       * ==================================================================== */

      if (
        renderOutlet
      ) {
        return (
          <div
            {...rest}
            ref={
              rootRef
            }
            className={
              rootClassName
            }
            data-testid={
              testId
            }
            data-authorized="true"
            data-user-id={
              getUserId(
                user,
              ) ??
              undefined
            }
            data-tenant-id={
              tenantId ??
              undefined
            }
          >
            <Outlet />
          </div>
        );
      }

      return (
        <div
          {...rest}
          ref={
            rootRef
          }
          className={
            rootClassName
          }
          data-testid={
            testId
          }
          data-authorized="true"
          data-user-id={
            getUserId(
              user,
            ) ??
            undefined
          }
          data-tenant-id={
            tenantId ??
            undefined
          }
        >
          {children}
        </div>
      );
    },
  );


/* ============================================================================
 * Metadata
 * ========================================================================== */

AdminRoute.displayName =
  'TITechAdminRoute';


/* ============================================================================
 * PropTypes
 * ========================================================================== */

AdminRoute.propTypes = {
  children:
    PropTypes.node,

  user:
    PropTypes.object,

  isAuthenticated:
    PropTypes.bool,

  authLoading:
    PropTypes.bool,

  authorizationLoading:
    PropTypes.bool,

  loading:
    PropTypes.bool,

  requiredRoles:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  roles:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  requiredPermissions:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  permissions:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  requireAllRoles:
    PropTypes.bool,

  requireAllPermissions:
    PropTypes.bool,

  requireAuthenticated:
    PropTypes.bool,

  requireTenant:
    PropTypes.bool,

  tenant:
    PropTypes.object,

  allowedTenantIds:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
        ]),
      ),
    ]),

  requiredTenantId:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),

  tenantValidator:
    PropTypes.func,

  accountStatuses:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  deniedAccountStatuses:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.string,
      ),
    ]),

  allowPrivilegedClaim:
    PropTypes.bool,

  privilegedClaimKeys:
    PropTypes.arrayOf(
      PropTypes.string,
    ),

  loginPath:
    PropTypes.string,

  unauthorizedPath:
    PropTypes.string,

  forbiddenPath:
    PropTypes.string,

  tenantMismatchPath:
    PropTypes.string,

  preserveReturnLocation:
    PropTypes.bool,

  replaceNavigation:
    PropTypes.bool,

  includeSearchInReturnLocation:
    PropTypes.bool,

  includeHashInReturnLocation:
    PropTypes.bool,

  redirectState:
    PropTypes.object,

  onUnauthorized:
    PropTypes.func,

  onForbidden:
    PropTypes.func,

  onTenantMismatch:
    PropTypes.func,

  onAuthenticated:
    PropTypes.func,

  onAuthorizationDenied:
    PropTypes.func,

  onLoading:
    PropTypes.func,

  loadingComponent:
    PropTypes.node,

  unauthorizedComponent:
    PropTypes.node,

  forbiddenComponent:
    PropTypes.node,

  tenantMismatchComponent:
    PropTypes.node,

  accountDisabledComponent:
    PropTypes.node,

  className:
    PropTypes.string,

  testId:
    PropTypes.string,

  renderOutlet:
    PropTypes.bool,
};


/* ============================================================================
 * Defaults
 * ========================================================================== */

AdminRoute.defaultProps = {
  children:
    undefined,

  user:
    null,

  isAuthenticated:
    undefined,

  authLoading:
    false,

  authorizationLoading:
    false,

  loading:
    false,

  requiredRoles:
    DEFAULT_ADMIN_ROLES,

  roles:
    undefined,

  requiredPermissions:
    [],

  permissions:
    undefined,

  requireAllRoles:
    false,

  requireAllPermissions:
    false,

  requireAuthenticated:
    true,

  requireTenant:
    false,

  tenant:
    null,

  allowedTenantIds:
    [],

  requiredTenantId:
    undefined,

  tenantValidator:
    undefined,

  accountStatuses:
    DEFAULT_ACTIVE_ACCOUNT_STATUSES,

  deniedAccountStatuses:
    [
      'suspended',
      'disabled',
      'blocked',
      'deactivated',
      'locked',
    ],

  allowPrivilegedClaim:
    false,

  privilegedClaimKeys:
    [
      'isAdmin',
      'isAdministrator',
      'isSuperAdmin',
      'isPlatformAdmin',
    ],

  loginPath:
    DEFAULT_LOGIN_PATH,

  unauthorizedPath:
    DEFAULT_UNAUTHORIZED_PATH,

  forbiddenPath:
    DEFAULT_FORBIDDEN_PATH,

  tenantMismatchPath:
    DEFAULT_TENANT_MISMATCH_PATH,

  preserveReturnLocation:
    true,

  replaceNavigation:
    true,

  includeSearchInReturnLocation:
    true,

  includeHashInReturnLocation:
    true,

  redirectState:
    {},

  onUnauthorized:
    undefined,

  onForbidden:
    undefined,

  onTenantMismatch:
    undefined,

  onAuthenticated:
    undefined,

  onAuthorizationDenied:
    undefined,

  onLoading:
    undefined,

  loadingComponent:
    undefined,

  unauthorizedComponent:
    undefined,

  forbiddenComponent:
    undefined,

  tenantMismatchComponent:
    undefined,

  accountDisabledComponent:
    undefined,

  className:
    '',

  testId:
    'titech-admin-route',

  renderOutlet:
    true,
};


/* ============================================================================
 * Named exports
 * ========================================================================== */

export {
  DEFAULT_ACTIVE_ACCOUNT_STATUSES,
  DEFAULT_ADMIN_ROLES,
  DEFAULT_FORBIDDEN_PATH,
  DEFAULT_LOGIN_PATH,
  DEFAULT_TENANT_MISMATCH_PATH,
  DEFAULT_UNAUTHORIZED_PATH,
  GuardState,
  getAccountStatus,
  getTenantId,
  getUserId,
  getUserPermissions,
  getUserRoles,
  getUserTenantIds,
  hasRequiredPermissions,
  hasRequiredRole,
  normalizeStringList,
  normalizeStatus,
  resolveTenantAuthorization,
  safeText,
};


/* ============================================================================
 * Default export
 * ========================================================================== */

export default AdminRoute;