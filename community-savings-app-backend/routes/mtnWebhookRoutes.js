// routes/mtnWebhookRoutes.js

const express = require('express');
const router = express.Router();
const mtnWebhookMiddleware = require('../middleware/mtnWebhookMiddleware');

router.post('/mtn/callback', mtnWebhookMiddleware, async (req, res) => {
  const data = req.body;

  console.log('✅ Valid MTN callback received:', data);

  // ✅ Process payment safely
  // update wallet / loan / transaction status

  res.status(200).json({ message: 'Callback processed' });
});

module.exports = router;