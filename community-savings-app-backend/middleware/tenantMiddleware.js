const jwt = require('jsonwebtoken');

module.exports = function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.tenantId) {
      return res.status(403).json({ message: 'Tenant context missing' });
    }

    // Attach tenant context
    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId;
    req.role = decoded.role;

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};// middleware/tenantMiddleware.js
"use strict";

const jwt = require("jsonwebtoken");
const logger = require("../utils/logger") || console;

/**
 * Tenant middleware
 * - Verifies JWT and extracts tenant context
 * - Enforces presenof tenantId, userId, and role
 * - Provides struce ctured error responses
 */
module.exports = function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("[TenantMiddleware] Missing or malformed Authorization header");
      return res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"], // enforce algorithm
        ignoreExpiration: false, // reject expired tokens
      });
    } catch (err) {
      logger.error("[TenantMiddleware] JWT verification failed", { error: err.message });
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
    }

    if (!decoded.tenantId || !decoded.userId || !decoded.role) {
      logger.warn("[TenantMiddleware] Token missing required claims", { decoded });
      return res.status(403).json({ success: false, message: "Forbidden: Tenant context missing" });
    }

    // Attach tenant context safely
    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId;
    req.role = decoded.role;

    logger.info("[TenantMiddleware] Tenant context attached", {
      tenantId: req.tenantId,
      userId: req.userId,
      role: req.role,
    });

    return next();
  } catch (error) {
    logger.error("[TenantMiddleware] Unexpected error", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
