// middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

/**
 * Extract token from headers
 */
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const headerToken = req.header('x-auth-token');
  if (headerToken) return headerToken.trim();
  return null;
}

/**
 * Verify JWT and attach user
 */
const verifyToken = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    const userId = decoded?.user?.id || decoded?.sub || decoded?.id;
    if (!userId) return res.status(401).json({ message: 'Invalid token structure' });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isActive === false) return res.status(403).json({ message: 'User account is inactive' });

    req.user = user;
    req.auth = decoded;
    req.token = token;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', error?.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

const isGroupAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'admin' || req.user.role === 'group_admin') return next();
  return res.status(403).json({ message: 'Group admin access required' });
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const roles = [req.user.role].concat(req.user.roles || []).map(String);
  if (allowedRoles.length === 0 || roles.some(r => allowedRoles.includes(r))) return next();
  return res.status(403).json({ message: 'Insufficient role' });
};

module.exports = { verifyToken, isAdmin, isGroupAdmin, requireRole };
