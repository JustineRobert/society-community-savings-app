
// controllers/authController.js
// ============================================================================
// Authentication Controller
// - Access tokens (JWT) with payload: { user: { id, email, role } }.
// - Opaque refresh tokens stored hashed in DB (RefreshToken model).
// - Rotation on refresh; reuse detection revokes all user tokens.
// - Admin and user session management.
// ============================================================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || '15m';
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';

const JWT_ISSUER = process.env.JWT_ISSUER || undefined;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || undefined;

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

function randomTokenString() {
  return crypto.randomBytes(64).toString('hex');
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function generateAccessToken(user) {
  // user can be a Mongoose document; use normalized primitives.
  const payload = {
    user: {
      id: user._id?.toString?.() || user.id || String(user),
      email: user.email,
      role: user.role,
      // If you store multiple roles, consider adding roles: user.roles
    },
  };
  const options = {
    expiresIn: ACCESS_TOKEN_EXP,
    ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, options);
}

async function createRefreshToken(userId, deviceInfo = {}) {
  const token = randomTokenString();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  const dbEntry = await RefreshToken.create({
    id: uuidv4(),
    userId,
    tokenHash,
    deviceInfo,
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
    revokedAt: null,
    revokedReason: null,
    replacedBy: null,
  });

  return { token, dbEntry };
}

// ----------------------------------------------------------------------------
// Public endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { email, password, name, deviceInfo } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = new User({ name, email, password });
    await user.save();

    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = await createRefreshToken(user._id, {
      ip: req.ip,
      ua: req.get('User-Agent'),
      ...(deviceInfo || {}),
    });

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      message: 'User registered',
      token: accessToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[AuthController] register error', err);
    return res.status(500).json({ message: 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password, deviceInfo } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password); // assumes schema method
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = await createRefreshToken(user._id, {
      ip: req.ip,
      ua: req.get('User-Agent'),
      ...(deviceInfo || {}),
    });

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[AuthController] login error', err);
    return res.status(500).json({ message: 'Login failed' });
  }
}

/**
 * POST /api/auth/refresh
 * Opaque refresh token rotation:
 * - If token is unknown: 401.
 * - If token is revoked: revoke all tokens for user (reuse protection), 401.
 * - If expired: 401.
 * - Else: rotate (revoke old, issue new), update cookie, return new access token.
 */
async function refresh(req, res, next) {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!presented) return res.status(401).json({ message: 'Missing refresh token' });

    const presentedHash = hashToken(presented);
    const dbToken = await RefreshToken.findOne({ tokenHash: presentedHash });

    if (!dbToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (dbToken.revokedAt) {
      // Reuse detected; revoke all active tokens for user.
      await RefreshToken.updateMany(
        { userId: dbToken.userId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'reuse_detected' } }
      );
      return res.status(401).json({
        message: 'Refresh token revoked (possible reuse). All sessions revoked.',
      });
    }

    if (dbToken.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Rotate: create new token; revoke old
    const { token: newToken, dbEntry: newDb } = await createRefreshToken(
      dbToken.userId,
      dbToken.deviceInfo
    );

    dbToken.revokedAt = new Date();
    dbToken.revokedReason = 'rotated';
    dbToken.replacedBy = newDb.id;
    await dbToken.save();

    const user = await User.findById(dbToken.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    setRefreshCookie(res, newToken);
    const accessToken = generateAccessToken(user);

    return res.status(200).json({ token: accessToken });
  } catch (err) {
    console.error('[AuthController] refresh error', err);
    return res.status(500).json({ message: 'Refresh failed' });
  }
}

/**
 * POST /api/auth/logout
 * Revokes current refresh token, clears cookie.
 */
async function logout(req, res, next) {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (presented) {
      try {
        const presentedHash = hashToken(presented);
        const dbToken = await RefreshToken.findOne({ tokenHash: presentedHash });
        if (dbToken && !dbToken.revokedAt) {
          dbToken.revokedAt = new Date();
          dbToken.revokedReason = 'logout';
          await dbToken.save();
        }
      } catch (_) {
        // ignore errors in token lookup
      }
    }
    clearRefreshCookie(res);
    return res.status(204).end();
  } catch (err) {
    console.error('[AuthController] logout error', err);
    return res.status(500).json({ message: 'Logout failed' });
  }
}

/**
 * POST /api/auth/logout-all
 * Revokes all refresh tokens for authenticated user.
 */
async function logoutAll(req, res, next) {
  try {
    if (!req.user?.id && !req.user?._id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const userId = req.user._id?.toString?.() || req.user.id;
    await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'user_logout_all' } }
    );
    clearRefreshCookie(res);
    return res.status(204).end();
  } catch (err) {
    console.error('[AuthController] logoutAll error', err);
    return res.status(500).json({ message: 'Logout all failed' });
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const user = req.user;
    return res.status(200).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      // include other non-sensitive fields if needed
    });
  } catch (err) {
    console.error('[AuthController] me error', err);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

/**
 * GET /api/auth/sessions
 * Lists refresh token sessions for authenticated user (basic).
 */
async function listSessions(req, res, next) {
  try {
    const userId = req.user._id?.toString?.() || req.user.id;
    const sessions = await RefreshToken.find({ userId })
      .select('id createdAt lastUsedAt expiresAt revokedAt revokedReason deviceInfo replacedBy')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[AuthController] listSessions error', err);
    return res.status(500).json({ message: 'Failed to list sessions' });
  }
}

/**
 * DELETE /api/auth/sessions/:id
 * Revokes a specific session belonging to the authenticated user.
 */
async function revokeSession(req, res, next) {
  try {
    const userId = req.user._id?.toString?.() || req.user.id;
    const { id } = req.params;

    const token = await RefreshToken.findOne({ id });
    if (!token) return res.status(404).json({ message: 'Session not found' });
    if (String(token.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Cannot revoke another user\'s session' });
    }
    if (!token.revokedAt) {
      token.revokedAt = new Date();
      token.revokedReason = 'user_revoked';
      await token.save();
    }

    return res.status(204).end();
  } catch (err) {
    console.error('[AuthController] revokeSession error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
}

// ----------------------------------------------------------------------------
// Admin-only session views/actions
// ----------------------------------------------------------------------------

/**
 * GET /api/auth/admin/sessions
 * Lists all sessions (admin).
 */
async function adminListSessions(req, res, next) {
  try {
    const sessions = await RefreshToken.find({})
      .select('id userId createdAt lastUsedAt expiresAt revokedAt revokedReason deviceInfo replacedBy')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[AuthController] adminListSessions error', err);
    return res.status(500).json({ message: 'Failed to list sessions (admin)' });
  }
}

/**
 * DELETE /api/auth/admin/sessions/:id
 * Revokes a session by ID (admin).
 */
async function adminRevokeSession(req, res, next) {
  try {
    const { id } = req.params;
    const token = await RefreshToken.findOne({ id });
    if (!token) return res.status(404).json({ message: 'Session not found' });

    if (!token.revokedAt) {
      token.revokedAt = new Date();
      token.revokedReason = 'admin_revoked';
      await token.save();
    }

    return res.status(204).end();
  } catch (err) {
    console.error('[AuthController] adminRevokeSession error', err);
    return res.status(500).json({ message: 'Failed to revoke session (admin)' });
  }
}

// ----------------------------------------------------------------------------
// Helpers exposed for router-level usage if needed (optional)
// ----------------------------------------------------------------------------

async function findUserByEmail(email) {
  return User.findOne({ email });
}
async function getUserById(userId) {
  return User.findById(userId);
}

module.exports = {
  // public
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,

  // user sessions
  listSessions,
  revokeSession,

  // admin sessions
  adminListSessions,
  adminRevokeSession,

  // helpers for router-level usage (optional)
  findUserByEmail,
  getUserById,
};
