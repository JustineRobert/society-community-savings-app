// routes/transactionRoutes.js

const express = require('express');
const router = express.Router();
const fraudMiddleware = require('../middleware/fraudMiddleware');

router.post('/withdraw', fraudMiddleware, async (req, res) => {
  res.json({ message: 'Withdrawal successful' });
});

module.exports = router;