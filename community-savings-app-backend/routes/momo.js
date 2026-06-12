const express = require('express');
const router = express.Router();

const Transaction = require('../models/Transaction');
const { calculateFraudScore } = require('../services/fraudEngine');

// ✅ Simulate MoMo deposit
router.post('/deposit', async (req, res) => {
  try {
    const { userId, amount, network } = req.body;

    // ✅ Get user transaction history (FIXED LOCATION)
    const history = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // ✅ Calculate fraud
    const fraud = calculateFraudScore({ amount }, history);

    const txn = new Transaction({
      user: userId,
      amount,
      type: 'deposit',
      network,
      status: 'success',
      reference: `MTN-${Date.now()}`,
      isFraud: fraud.isFraud,
      fraudScore: fraud.score,
    });

    await txn.save();

    res.json({ success: true, transaction: txn });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, message: 'Deposit failed' });
  }
});

// ✅ Simulate withdrawal
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount, network } = req.body;

    // ✅ Get user transaction history
    const history = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // ✅ Fraud scoring
    const fraud = calculateFraudScore({ amount }, history);

    const txn = new Transaction({
      user: userId,
      amount,
      type: 'withdraw',
      network,
      status: 'success',
      reference: `AIR-${Date.now()}`,
      isFraud: fraud.isFraud,
      fraudScore: fraud.score,
    });

    await txn.save();

    res.json({ success: true, transaction: txn });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Withdrawal failed' });
  }
});

module.exports = router;