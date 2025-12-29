
// routes/index.js

const express = require('express');
const router = express.Router();

/**
 * Central routes registry.
 * Add feature routers here to keep server.js minimal and avoid circular requires.
 */
router.use('/contributions', require('./contributions'));
// router.use('/groups', require('./groups'));
// router.use('/users', require('./users'));

module.exports = router;
