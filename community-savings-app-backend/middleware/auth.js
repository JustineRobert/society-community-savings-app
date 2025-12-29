
// middleware/auth.js
// ============================================================================
// Authentication & Authorization Middleware
// - Verifies JWT access token (supports 'Authorization: Bearer' or 'x-auth-token').
// - Loads active user document and attaches to req.user.
// - Role gating helpers (admin, group admin, requireRole).
// ============================================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || undefined;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || undefined;

/**
 * Extracts token from Authorization header (Bearer) or x-auth-token header.
 */
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const headerToken = req.header('x-auth-token');
  if (headerToken) return headerToken.trim();
  return null;
}

/**
 * Verifies the JWT access token and loads the user.
 * Attaches:
 *   - req.user: Mongoose user document (active account required)
 *   - req.auth: the decoded token payload (for auditing)
 *   - req.token: raw token string
 */
const verifyToken = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
      ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
    });

    // Expect payload shape: { user: { id, email, role } } (per your controllers)
    const userId = decoded?.user?.id || decoded?.sub || decoded?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token structure' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isActive === false) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    // Attach user doc and token context
    req.user = user;    // Mongoose doc; req.user.id is available as string
    req.auth = decoded; // raw decoded JWT payload
    req.token = token;

    next();
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', error?.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Middleware: Admin-only access (single-role string).
 */
const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

/**
 * Middleware: Group admin or platform admin.
 */
const isGroupAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'admin' || req.user.role === 'group_admin') return next();
  return res.status(403).json({ message: 'Group admin access required' });
};

/**
 * Middleware factory: require any of the allowed roles.
 * Supports a single role string or an array stored on user (`user.roles`).
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const userRoles = [];
  // normalize to array of strings
  if (Array.isArray(req.user.roles)) userRoles.push(...req.user.roles.map(String));
  if (req.user.role) userRoles.push(String(req.user.role));

  if (allowedRoles.length === 0) return next(); // no restriction
  const hasRole = userRoles.some((r) => allowedRoles.includes(r));
  if (!hasRole) return res.status(403).json({ message: 'Insufficient role' });

  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isGroupAdmin,
  requireRole,
};
