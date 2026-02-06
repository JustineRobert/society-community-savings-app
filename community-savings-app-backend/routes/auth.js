
// routes/auth.js
// ============================================================================
// Authentication Routes
// - Access & refresh token issuance/rotation (with secure cookie for refresh).
// - Registration and login validation.
// - Protected profile and admin session management.
// ============================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const asyncHandler = require('../utils/asyncHandler');
const { validationRules, handleValidation } = require('../utils/validators');
const { verifyToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// ----------------------------------------------------------------------------
// Token Secrets & TTLs (compatible with your server.js ENV validation)
// ----------------------------------------------------------------------------
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '10m';   // short-lived access
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d'; // long-lived refresh

const JWT_ISSUER = process.env.JWT_ISSUER || undefined;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || undefined;

// ----------------------------------------------------------------------------
// Refresh token store (in-memory). Replace with Redis/DB keyed by jti in prod.
// ----------------------------------------------------------------------------
const refreshStore = new Map();

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Issue an access token for the given user payload.
 * @param {{ id: string, email: string, roles?: string[] }} user
 */
function signAccessToken(user) {
  const payload = { sub: user.id, email: user.email, roles: user.roles || [] };
  const options = {
    expiresIn: ACCESS_TOKEN_TTL,
    ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  };
  return jwt.sign(payload, ACCESS_SECRET, options);
}

/**
 * Issue a refresh token with jti.
 * @param {string} userId
 * @param {string} jti
 */
function signRefreshToken(userId, jti) {
  const payload = { sub: userId, jti };
  const options = {
    expiresIn: REFRESH_TOKEN_TTL,
    ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  };
  return jwt.sign(payload, REFRESH_SECRET, options);
}

function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,           // HTTPS only in production
    sameSite: isProd ? 'strict' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function cryptoRandomString() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Delegates to controller for user lookup by email.
 * Implement `authController.findUserByEmail` or adjust here to your data layer.
 */
async function findUserByEmail(email) {
  if (typeof authController.findUserByEmail === 'function') {
    return authController.findUserByEmail(email);
  }
  throw Object.assign(new Error('findUserByEmail(email) not implemented'), { statusCode: 500 });
}

/**
 * Delegates to controller for user lookup by id.
 */
async function getUserById(userId) {
  if (typeof authController.getUserById === 'function') {
    return authController.getUserById(userId);
  }
  // Fallback minimal payload if controller not implemented
  return { id: userId, email: undefined, roles: [] };
}

// ----------------------------------------------------------------------------
// Per-route rate limiting (in addition to global limiter in server.js)
// ----------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 20,               // 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 120,              // 120 refreshes per minute (2 per second)
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit for valid refresh tokens (optional, if you implement token validation)
  skip: (req) => {
    // In production, you could validate the refresh token before counting the limit
    // For now, we apply rate limit to all requests
    return false;
  },
  message: 'Too many refresh attempts. Please wait before retrying.',
});

/**
 * Register rate limiter: Prevent brute-force account creation
 * 5 registrations per 15 minutes per IP to allow legitimate users but prevent abuse
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,                  // 5 registration attempts per IP per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many account creation attempts. Please try again later.',
  skip: (req) => false, // Apply rate limit to all registration requests
});
// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

/**
 * REGISTER — delegates to controller, validated inputs forwarded to global error handler
 */
router.post(
  '/register',
  registerLimiter,
  validationRules.register,
  handleValidation,
  asyncHandler(authController.register)
);

/**
 * LOGIN — issues access + refresh (cookie). Validated inputs, strict rate limit.
 */
router.post(
  '/login',
  loginLimiter,
  validationRules.login,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    // Around line 160-164 in auth.js
    if (!user || !user.password) {
      return res.status(401).json({
        message: "Invalid credentials",
        type: "AuthenticationError"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ errorId: req.requestId, message: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const jti = cryptoRandomString();
    const refreshToken = signRefreshToken(user.id, jti);

    // Persist/rotate refresh token record (replace with Redis/DB in production)
    refreshStore.set(jti, { userId: user.id, exp: Date.now() + 30 * 24 * 3600 * 1000 });

    setRefreshCookie(res, refreshToken);
    res.status(200).json({
      accessToken,
      user: { id: user.id, email: user.email, roles: user.roles || [] },
    });
  })
);

/**
 * REFRESH — cookie-based rotation and new access token
 * Protect with per-route limiter.
 */
router.post(
  '/refresh',
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const { [REFRESH_COOKIE_NAME]: refreshToken } = req.cookies || {};
    if (!refreshToken) {
      return res.status(401).json({ errorId: req.requestId, message: 'Missing refresh token' });
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET, {
        ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
        ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
      });
    } catch (err) {
      return res.status(401).json({ errorId: req.requestId, message: 'Invalid/expired refresh token' });
    }

    const { sub: userId, jti: oldJti } = payload;
    const record = refreshStore.get(oldJti);
    if (!record || record.userId !== userId) {
      return res.status(401).json({ errorId: req.requestId, message: 'Refresh token revoked' });
    }

    // Rotate refresh token
    refreshStore.delete(oldJti);
    const newJti = cryptoRandomString();
    refreshStore.set(newJti, { userId, exp: Date.now() + 30 * 24 * 3600 * 1000 });
    const newRefresh = signRefreshToken(userId, newJti);
    setRefreshCookie(res, newRefresh);

    // Issue new access token
    const fullUser = await getUserById(userId);
    const accessToken = signAccessToken(fullUser);

    res.json({
      accessToken,
      token: accessToken, // Include both for backwards compatibility
      user: fullUser,
    });
  })
);

/**
 * LOGOUT — revoke current refresh token and clear cookie
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { [REFRESH_COOKIE_NAME]: refreshToken } = req.cookies || {};
    if (refreshToken) {
      try {
        const { jti } = jwt.verify(refreshToken, REFRESH_SECRET);
        refreshStore.delete(jti);
      } catch (_) {
        // ignore verification errors; still clear cookie
      }
    }
    clearRefreshCookie(res);
    res.status(204).end();
  })
);

/**
 * ME — simple identity probe using verifyToken middleware (matches other feature routes)
 */
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req, res) => {
    if (typeof authController.me === 'function') {
      return authController.me(req, res);
    }
    res.json({ userId: req.user.id || req.user.sub, email: req.user.email, roles: req.user.roles || [] });
  })
);

/**
 * Admin session management
 */
router.get(
  '/admin/sessions',
  verifyToken,
  requireRole('admin'),
  asyncHandler(authController.adminListSessions)
);

router.delete(
  '/admin/sessions/:id',
  verifyToken,
  requireRole('admin'),
  asyncHandler(authController.adminRevokeSession)
);

module.exports = router;
