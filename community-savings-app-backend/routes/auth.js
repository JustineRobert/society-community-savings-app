// routes/auth.js

const express = require('express');
const { validationRules, handleValidationErrors } = require('../utils/validators');
const { verifyToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
require('dotenv').config();

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validationRules.register, handleValidationErrors, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login', validationRules.login, handleValidationErrors, authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private (Requires valid token)
 */
router.get('/me', verifyToken, authController.me);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using the stored refresh token
 * @access  Public (Requires valid refresh token)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user by clearing refresh token cookie
 * @access  Public
 */
router.post('/logout', authController.logout);

// Logout all sessions (requires valid access token)
router.post('/logoutAll', verifyToken, authController.logoutAll);

// Sessions listing and revocation
router.get('/sessions', verifyToken, authController.listSessions);
router.delete('/sessions/:id', verifyToken, authController.revokeSession);

// Admin session management: list/revoke sessions across users
router.get('/admin/sessions', verifyToken, requireRole('admin'), authController.adminListSessions);
router.delete('/admin/sessions/:id', verifyToken, requireRole('admin'), authController.adminRevokeSession);

module.exports = router;
