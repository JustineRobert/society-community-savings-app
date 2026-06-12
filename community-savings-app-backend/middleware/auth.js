// middleware/auth.js

"use strict";

const jwt = require("jsonwebtoken");

/**
 * Extract Bearer token from Authorization header
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

/**
 * Authenticate user via JWT
 */
exports.authenticate = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * Attach user payload
     * Expected structure:
     * {
     *   id,
     *   saccoId,
     *   role,
     *   ...
     * }
     */
    req.user = decoded;
    req.token = token;

    return next();
  } catch (error) {
    console.error("[Auth] JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * Role-based access control (RBAC)
 */
exports.requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const userRoles = [req.user.role, ...(req.user.roles || [])].filter(Boolean);

    if (allowedRoles.length === 0 || userRoles.some((r) => allowedRoles.includes(r))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden: Insufficient permissions",
    });
  };

/**
 * Optional helpers (clean aliases)
 */
exports.isAdmin = exports.requireRole("admin");
exports.isGroupAdmin = exports.requireRole("admin", "group_admin");