// ============================================================================
// backend/middleware/auth.js
// TITech Community Capital
// Enterprise Authentication & Authorization Middleware
// Production Grade
// ============================================================================

'use strict';

const jwt = require('jsonwebtoken');

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET or ACCESS_TOKEN_SECRET must be configured'
  );
}

// ============================================================================
// TOKEN EXTRACTION
// ============================================================================

function extractToken(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization;

  if (
    typeof authHeader === 'string' &&
    authHeader.startsWith('Bearer ')
  ) {
    return authHeader.substring(7).trim();
  }

  const xAuthToken =
    req.headers['x-auth-token'];

  if (xAuthToken) {
    return xAuthToken;
  }

  return null;
}

// ============================================================================
// USER NORMALIZATION
// ============================================================================

function normalizeUser(decoded) {
  if (!decoded) return null;

  if (decoded.user) {
    return {
      id: decoded.user.id,
      _id: decoded.user.id,
      email: decoded.user.email,
      role: decoded.user.role,
      roles: decoded.user.roles || [],
      permissions:
        decoded.user.permissions || [],
      tenantId:
        decoded.user.tenantId ||
        decoded.tenantId,
      isVerified:
        decoded.user.isVerified,
      isActive:
        decoded.user.isActive,
    };
  }

  return {
    id: decoded.id,
    _id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    roles: decoded.roles || [],
    permissions:
      decoded.permissions || [],
    tenantId: decoded.tenantId,
    isVerified: decoded.isVerified,
    isActive: decoded.isActive,
  };
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

function verifyJwtToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256', 'HS384', 'HS512'],
  });
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticate(
  req,
  res,
  next
) {
  try {
    const token =
      extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_MISSING',
        message:
          'Authentication token required',
      });
    }

    const decoded =
      verifyJwtToken(token);

    const user =
      normalizeUser(decoded);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message:
          'Unable to identify user',
      });
    }

    req.token = token;
    req.jwt = decoded;
    req.user = user;

    req.auth = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions:
        user.permissions || [],
    };

    return next();
  } catch (error) {
    console.error(
      '[AUTH]',
      error.message
    );

    if (
      error.name ===
      'TokenExpiredError'
    ) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message:
          'Access token expired',
      });
    }

    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message:
        'Invalid authentication token',
    });
  }
}

// ============================================================================
// OPTIONAL AUTH
// ============================================================================

async function optionalAuth(
  req,
  res,
  next
) {
  try {
    const token =
      extractToken(req);

    if (!token) {
      return next();
    }

    const decoded =
      verifyJwtToken(token);

    req.token = token;
    req.jwt = decoded;
    req.user =
      normalizeUser(decoded);

    return next();
  } catch {
    return next();
  }
}

// ============================================================================
// ROLE AUTHORIZATION
// ============================================================================

function requireRole(
  ...allowedRoles
) {
  const roles =
    allowedRoles.map((r) =>
      String(r).toLowerCase()
    );

  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message:
          'Authentication required',
      });
    }

    const userRoles = [
      req.user.role,
      ...(req.user.roles || []),
    ]
      .filter(Boolean)
      .map((r) =>
        String(r).toLowerCase()
      );

    const allowed =
      userRoles.some((role) =>
        roles.includes(role)
      );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_ROLE',
        message:
          'Insufficient role permissions',
      });
    }

    next();
  };
}

// ============================================================================
// PERMISSION AUTHORIZATION
// ============================================================================

function requirePermission(
  ...permissions
) {
  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message:
          'Authentication required',
      });
    }

    const userPermissions =
      req.user.permissions || [];

    const authorized =
      permissions.every(
        (permission) =>
          userPermissions.includes(
            permission
          )
      );

    if (!authorized) {
      return res.status(403).json({
        success: false,
        code:
          'INSUFFICIENT_PERMISSION',
        message:
          'Permission denied',
      });
    }

    next();
  };
}

// ============================================================================
// TENANT VALIDATION
// ============================================================================

function requireTenant(
  req,
  res,
  next
) {
  const tenantId =
    req.headers[
      'x-tenant-id'
    ];

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      code: 'TENANT_REQUIRED',
      message:
        'Tenant ID required',
    });
  }

  req.tenantId =
    tenantId;

  next();
}

// ============================================================================
// TENANT ACCESS CONTROL
// ============================================================================

function enforceTenantAccess(
  req,
  res,
  next
) {
  if (
    !req.user ||
    !req.user.tenantId
  ) {
    return res.status(403).json({
      success: false,
      code: 'TENANT_DENIED',
      message:
        'Tenant access denied',
    });
  }

  const requestTenant =
    req.headers[
      'x-tenant-id'
    ];

  if (
    requestTenant &&
    requestTenant !==
      req.user.tenantId
  ) {
    return res.status(403).json({
      success: false,
      code:
        'TENANT_MISMATCH',
      message:
        'Tenant mismatch detected',
    });
  }

  next();
}

// ============================================================================
// ACCOUNT STATUS CHECK
// ============================================================================

function requireActiveUser(
  req,
  res,
  next
) {
  if (
    req.user &&
    req.user.isActive === false
  ) {
    return res.status(403).json({
      success: false,
      code:
        'ACCOUNT_DISABLED',
      message:
        'Account is disabled',
    });
  }

  next();
}

// ============================================================================
// COMMON ROLE SHORTCUTS
// ============================================================================

const isAdmin =
  requireRole('admin');

const isSuperAdmin =
  requireRole(
    'super_admin'
  );

const isGroupAdmin =
  requireRole(
    'admin',
    'group_admin'
  );

const isAuditor =
  requireRole(
    'auditor'
  );

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  authenticate,
  verifyToken:
    authenticate,

  optionalAuth,

  requireRole,
  requirePermission,

  requireTenant,
  enforceTenantAccess,

  requireActiveUser,

  isAdmin,
  isSuperAdmin,
  isGroupAdmin,
  isAuditor,

  extractToken,
  normalizeUser,
};