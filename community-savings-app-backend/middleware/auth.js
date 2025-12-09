// middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: Validates JWT from request header
 * Attaches the corresponding user object (without password) to req.user
 */
const verifyToken = async (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.user || !decoded.user.id) {
      return res.status(401).json({ message: 'Invalid token structure' });
    }

    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Middleware: Enforces admin-only access
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({ message: 'Admin access required' });
};

/**
 * Middleware: Enforces group admin or owner access
 */
const isGroupAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role === 'admin' || req.user.role === 'group_admin') {
    return next();
  }

  return res.status(403).json({ message: 'Group admin access required' });
};

module.exports = {
  verifyToken,
  isAdmin,
  isGroupAdmin,
};
