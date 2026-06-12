// controllers/loansController.js
const { LedgerEntry } = require("../models");
const AuditLog = require("../mongo/AuditLog");

exports.createLoan = async (req, res) => {
  const { saccoId, memberId, amount } = req.body;
  if (!req.user.roles.includes("ADMIN")) return res.status(403).json({ error: "Forbidden" });

  const entry = await LedgerEntry.create({
    saccoId,
    debitAccount: `GroupWallet:${saccoId}`,
    creditAccount: `Loan:${memberId}`,
    amount,
    reference: `LOAN-${Date.now()}`
  });
  await AuditLog.create({ action: "LOAN_DISBURSEMENT", actorId: req.user.id, saccoId, endpoint: req.originalUrl, payload: req.body });
  res.status(202).json({ success: true, entry });
};
