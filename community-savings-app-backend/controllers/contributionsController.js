// controllers/contributionsController.js
const { LedgerEntry } = require("../models");
const AuditLog = require("../mongo/AuditLog");

exports.createContribution = async (req, res) => {
  const { saccoId, memberId, amount, paymentReference } = req.body;
  try {
    const entry = await LedgerEntry.create({
      saccoId,
      debitAccount: `MoMo:${memberId}`,
      creditAccount: `GroupWallet:${saccoId}`,
      amount,
      reference: paymentReference
    });
    await AuditLog.create({ action: "CONTRIBUTION", actorId: memberId, saccoId, endpoint: req.originalUrl, payload: req.body });
    res.status(202).json({ success: true, entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
