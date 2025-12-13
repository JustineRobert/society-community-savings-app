const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || '15m';
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

function randomTokenString() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  const payload = {
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
  };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXP });
}

async function createRefreshToken(userId, deviceInfo = {}) {
  const token = randomTokenString();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const dbEntry = await RefreshToken.create({
    id: uuidv4(),
    userId,
    tokenHash,
    deviceInfo,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt,
    revokedAt: null,
    revokedReason: null,
    replacedBy: null,
  });
  return { token, dbEntry };
}

// Register
async function register(req, res) {
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

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

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

// Login
async function login(req, res) {
  try {
    const { email, password, deviceInfo } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = await createRefreshToken(user._id, {
      ip: req.ip,
      ua: req.get('User-Agent'),
      ...(deviceInfo || {}),
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

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

// Refresh (rotation + reuse detection)
async function refresh(req, res) {
  try {
    const presented = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!presented) return res.status(401).json({ message: 'Missing refresh token' });

    const presentedHash = hashToken(presented);
    const dbToken = await RefreshToken.findOne({ tokenHash: presentedHash });

    if (!dbToken) {
      // unknown token: cannot determine user easily
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (dbToken.revokedAt) {
      // Token reuse detected. Revoke all tokens for user.
      await RefreshToken.updateMany({ userId: dbToken.userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'reuse_detected' } });
      return res.status(401).json({ message: 'Refresh token revoked (possible reuse). All sessions revoked.' });
    }

    if (dbToken.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Rotation: issue new refresh token
    const { token: newToken, dbEntry: newDb } = await createRefreshToken(dbToken.userId, dbToken.deviceInfo);

    dbToken.revokedAt = new Date();
    dbToken.revokedReason = 'rotated';
    dbToken.replacedBy = newDb.id;
    await dbToken.save();

    const user = await User.findById(dbToken.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const accessToken = generateAccessToken(user);

    // set new cookie
    res.cookie('refreshToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ message: 'Token refreshed', token: accessToken });
  } catch (err) {
    console.error('[AuthController] refresh error', err);
    return res.status(500).json({ message: 'Refresh failed' });
  }
}

// Logout current session
async function logout(req, res) {
  try {
    const presented = req.cookies?.refreshToken || req.body?.refreshToken;
    if (presented) {
      const presentedHash = hashToken(presented);
      const dbToken = await RefreshToken.findOne({ tokenHash: presentedHash });
      if (dbToken && !dbToken.revokedAt) {
        dbToken.revokedAt = new Date();
        dbToken.revokedReason = 'logout';
        await dbToken.save();
      }
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    console.error('[AuthController] logout error', err);
    return res.status(500).json({ message: 'Logout failed' });
  }
}

// Logout all sessions
async function logoutAll(req, res) {
  try {
    // req.user populated by middleware.verifyToken
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return res.status(200).json({ message: 'All sessions logged out' });
  } catch (err) {
    console.error('[AuthController] logoutAll error', err);
    return res.status(500).json({ message: 'Logout all failed' });
  }
}

// Get current user info (keeps behavior compatible with existing verifyToken middleware)
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ id: user._id, email: user.email, name: user.name, role: user.role, lastLogin: user.lastLogin });
  } catch (err) {
    console.error('[AuthController] me error', err);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}

// List active sessions for current user
async function listSessions(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const sessions = await RefreshToken.find({ userId }).select('-tokenHash -__v');
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[AuthController] listSessions error', err);
    return res.status(500).json({ message: 'Failed to list sessions' });
  }
}

// Revoke a specific session by id
async function revokeSession(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const sessionId = req.params.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const token = await RefreshToken.findOne({ id: sessionId, userId });
    if (!token) return res.status(404).json({ message: 'Session not found' });
    if (!token.revokedAt) {
      token.revokedAt = new Date();
      token.revokedReason = 'revoked_by_user';
      await token.save();
    }
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    console.error('[AuthController] revokeSession error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
}

// --- Admin-only session management ---
// List all sessions (optionally filter by userId via query param)
async function adminListSessions(req, res) {
  try {
    const userIdFilter = req.query.userId;
    const query = {};
    if (userIdFilter) query.userId = userIdFilter;
    const sessions = await RefreshToken.find(query).select('-tokenHash -__v');
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[AuthController] adminListSessions error', err);
    return res.status(500).json({ message: 'Failed to list sessions' });
  }
}

// Revoke any session by id (admin only)
async function adminRevokeSession(req, res) {
  try {
    const sessionId = req.params.id;
    if (!sessionId) return res.status(400).json({ message: 'Missing session id' });
    const token = await RefreshToken.findOne({ id: sessionId });
    if (!token) return res.status(404).json({ message: 'Session not found' });
    if (!token.revokedAt) {
      token.revokedAt = new Date();
      token.revokedReason = 'revoked_by_admin';
      await token.save();
    }
    return res.status(200).json({ message: 'Session revoked by admin' });
  } catch (err) {
    console.error('[AuthController] adminRevokeSession error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
}

module.exports = { register, login, refresh, logout, logoutAll, me, listSessions, revokeSession, adminListSessions, adminRevokeSession };

