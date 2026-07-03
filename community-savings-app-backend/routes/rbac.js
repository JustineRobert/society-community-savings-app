const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const checkPermission = require('../middleware/checkPermission');
const rbacController = require('../controllers/rbac.controller');

// Only users with roles:manage permission can use these endpoints
router.post('/permission', requireAuth, checkPermission('roles:manage'), rbacController.createPermission);
router.post('/role', requireAuth, checkPermission('roles:manage'), rbacController.createRole);
router.post('/assign', requireAuth, checkPermission('roles:manage'), rbacController.assignRole);

module.exports = router;
