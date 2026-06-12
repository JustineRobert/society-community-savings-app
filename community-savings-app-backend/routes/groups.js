// routes/groups.js
const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { validationRules, handleValidation } = require('../utils/validators');
const groupController = require('../controllers/groupController');
const { verifyToken } = require('../middleware/auth');


router.post(
  '/groups',
  verifyToken,
  asyncHandler(groupController.createGroup) // ensure this is exported
);

router.post(
  '/:groupId/send-invitations',
  verifyToken,
  [param('groupId').isMongoId().withMessage('Invalid group ID')],
  handleValidation,
  asyncHandler(groupController.sendBatchInvitations)
);

router.post(
  '/join/:id',
  verifyToken,
  [param('id').isMongoId().withMessage('Invalid group ID')],
  handleValidation,
  asyncHandler(groupController.joinGroup)
);

router.get(
  '/',
  verifyToken,
  asyncHandler(groupController.getGroups) // ✅ direct controller
);

router.post('/seed', verifyToken, asyncHandler(groupController.seedGroups));

module.exports = router;
