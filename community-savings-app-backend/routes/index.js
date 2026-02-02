
// routes/index.js

const express = require('express');
const router = express.Router();

/**
 * Central routes registry.
 * Add feature routers here to keep server.js minimal and avoid circular requires.
 */

// Core Authentication & Email
router.use('/auth', require('./auth'));
router.use('/email', require('./email'));

// Features
router.use('/contributions', require('./contributions'));
// router.use('/groups', require('./groups'));
// router.use('/users', require('./users'));
// router.use('/loans', require('./loans'));
// router.use('/payments', require('./payments'));
// router.use('/referrals', require('./referrals'));
// router.use('/chat', require('./chat'));
// router.use('/settings', require('./settings'));

module.exports = router;
