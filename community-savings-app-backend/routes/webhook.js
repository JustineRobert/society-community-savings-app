const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// ✅ MTN callback
router.post('/momo/callback', async (req, res) => {
  const data = req.body;

  const txn = await Transaction.findOne({
    reference: data.externalId,
  });

  if (txn) {
    txn.status = data.status;
    txn.completedAt = new Date();
    await txn.save();
  }

  res.sendStatus(200);
});

module.exports = router;