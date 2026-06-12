// controllers/transaction.controller.js

const asyncHandler = require("../middlewares/asyncHandler");
const transactionService = require("../services/transaction.service");
const momoService = require("../services/momo.service");
const Transaction = require("../models/Transaction");

// ✅ Deposit Request
exports.deposit = asyncHandler(async (req, res) => {
  const { amount, phone } = req.body;

  const transaction = await transactionService.createDeposit({
    user: req.user.id,
    amount,
    phone,
    source: "MTN_MOMO",
  });

  await momoService.initiateDeposit({
    phone,
    amount,
    reference: transaction.reference,
  });

  res.status(201).json({
    success: true,
    transaction,
  });
});

// ✅ Withdraw Request
exports.withdraw = asyncHandler(async (req, res) => {
  const { amount, phone } = req.body;

  const transaction = await transactionService.createWithdraw({
    user: req.user.id,
    amount,
    phone,
    source: "MTN_MOMO",
  });

  await momoService.initiateWithdraw({
    phone,
    amount,
    reference: transaction.reference,
  });

  res.status(201).json({
    success: true,
    transaction,
  });
});

// ✅ MoMo Callback/Webhook
exports.momoWebhook = asyncHandler(async (req, res) => {
  const { externalId, status } = req.body;

  const transaction = await Transaction.findOne({
    reference: externalId,
  });

  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  if (status === "SUCCESSFUL") {
    await transactionService.processSuccessfulTransaction(transaction);
  } else {
    await transactionService.processFailedTransaction(
      transaction,
      "MoMo failure"
    );
  }

  res.status(200).json({ message: "Webhook processed" });
});