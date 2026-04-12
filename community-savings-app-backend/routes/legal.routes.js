const express = require('express');
const router = express.Router();
const legalController = require('../controllers/legalController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

/**
 * Legal Routes
 * Handles Terms of Service and Privacy Policy endpoints
 */

// Public endpoints - no authentication required
router.get('/terms-of-service', legalController.getTermsOfService);
router.get('/privacy-policy', legalController.getPrivacyPolicy);
router.get('/changelog', legalController.getChangelog);

// Protected endpoints - requires authentication
router.post('/accept-terms', verifyAccessToken, legalController.acceptTermsAndPrivacy);
router.get('/acceptance-status', verifyAccessToken, legalController.getAcceptanceStatus);

module.exports = router;
