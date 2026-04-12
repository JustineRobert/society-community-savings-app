/**
 * FAQ Routes
 */

const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');

// Public endpoints
router.get('/categories', faqController.getCategories);
router.get('/all', faqController.getAllFAQs);
router.get('/category/:slug', faqController.getFAQsByCategory);
router.get('/featured', faqController.getFeaturedFAQs);
router.get('/popular', faqController.getPopularFAQs);
router.get('/search', faqController.searchFAQs);
router.get('/:id', faqController.getFAQ);

// Feedback endpoint (no auth required but recommended)
router.post('/:id/feedback', faqController.submitFeedback);

// Admin endpoints
router.post('/init', faqController.initializeFAQ);

module.exports = router;
