// routes/auth.js

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationRules, handleValidationErrors } = require('../utils/validators');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Generate access and refresh tokens for authenticated users.
 */
const generateTokens = (user) => {
  if (!user._id || !user.email) {
    throw new Error('Invalid user object for token generation');
  }
  
  const payload = { 
    user: { 
      id: user._id.toString(),
      email: user.email, 
      role: user.role 
    }
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  
  return { accessToken, refreshToken };
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validationRules.register, handleValidationErrors, async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password, // Will be hashed in pre-save middleware
    });

    await newUser.save();

    // Generate tokens
    const tokens = generateTokens(newUser);

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      token: tokens.accessToken,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err.message);
    res.status(500).json({ 
      message: 'Registration failed', 
      error: process.env.NODE_ENV === 'production' ? undefined : err.message 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login', validationRules.login, handleValidationErrors, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateTokens(user);

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      token: tokens.accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ 
      message: 'Login failed', 
      error: process.env.NODE_ENV === 'production' ? undefined : err.message 
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private (Requires valid token)
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      profile: user.profile,
      bonus: user.bonus,
      referralCode: user.referralCode,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    console.error('[Auth] Get user error:', err.message);
    res.status(500).json({ 
      message: 'Failed to fetch user', 
      error: process.env.NODE_ENV === 'production' ? undefined : err.message 
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using the stored refresh token
 * @access  Public (Requires valid refresh token)
 */
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Missing refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    const payload = {
      user: {
        id: decoded.user.id,
        email: decoded.user.email,
        role: decoded.user.role,
      }
    };
    
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    res.status(200).json({ 
      message: 'Token refreshed successfully',
      token: accessToken 
    });
  } catch (err) {
    console.error('[Auth] Refresh error:', err.message);
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user by clearing refresh token cookie
 * @access  Public
 */
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
