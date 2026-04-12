/**
 * Help Center Routes
 */

const express = require('express');
const router = express.Router();
const helpCenterController = require('../controllers/helpCenterController');

// Public endpoints
router.get('/categories', helpCenterController.getCategories);
router.get('/category/:slug', helpCenterController.getArticlesByCategory);
router.get('/article/:slug', helpCenterController.getArticle);
router.get('/search', helpCenterController.searchArticles);
router.get('/featured', helpCenterController.getFeaturedArticles);
router.get('/popular', helpCenterController.getPopularArticles);

// Feedback endpoint (no auth required but recommended)
router.post('/article/:slug/feedback', helpCenterController.submitFeedback);

// Admin endpoints
router.post('/init', helpCenterController.initializeHelpCenter);

module.exports = router;
