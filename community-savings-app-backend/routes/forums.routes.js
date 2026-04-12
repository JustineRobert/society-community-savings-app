/**
 * Community Forums Routes
 */

const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

// Public endpoints
router.get('/categories', forumController.getCategories);
router.get('/category/:slug', forumController.getTopicsByCategory);
router.get('/topic/:slug', forumController.getTopic);
router.get('/trending', forumController.getTrendingTopics);
router.get('/latest', forumController.getLatestTopics);
router.get('/search', forumController.searchTopics);

// Protected endpoints
router.post('/topic', verifyAccessToken, forumController.createTopic);
router.post('/topic/:topicId/reply', verifyAccessToken, forumController.addReply);
router.post('/reply/:replyId/accept', verifyAccessToken, forumController.acceptAnswer);
router.post('/:targetId/react', verifyAccessToken, forumController.reactToContent);

// Admin endpoints
router.post('/init', forumController.initializeForum);

module.exports = router;
