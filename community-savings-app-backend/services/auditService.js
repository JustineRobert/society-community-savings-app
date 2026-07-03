const AuditLog = require('../models/AuditLog');

async function logAction({ action, userId, tenantId, entityType, entityId, metadata }) {
  const entry = new AuditLog({ action, userId, tenantId, entityType, entityId, metadata });
  await entry.save();
  return entry;
}

module.exports = { logAction };
// services/auditService.js
const mongoose = require("mongoose");

/**
 * Aggregation pipeline to unify Transaction, LedgerEntry, and AuditLog
 * into a single chronological timeline by requestId + tenantId
 */
exports.getUnifiedTimeline = async (tenantId, requestId) => {
  if (!tenantId || !requestId) {
    throw new Error("tenantId and requestId are required");
  }

  const pipeline = [
    // 🔹 Start with Transactions
    {
      $match: { tenantId: new mongoose.Types.ObjectId(tenantId), requestId },
    },
    {
      $project: {
        type: { $literal: "Transaction" },
        id: "$_id",
        status: 1,
        amount: 1,
        currency: 1,
        description: 1,
        createdAt: 1,
      },
    },

    // 🔹 Union with LedgerEntries
    {
      $unionWith: {
        coll: "ledgerentries",
        pipeline: [
          { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), requestId } },
          {
            $project: {
              type: { $literal: "LedgerEntry" },
              id: "$_id",
              debitAccount: 1,
              creditAccount: 1,
              amount: 1,
              currency: 1,
              reference: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },

    // 🔹 Union with AuditLogs
    {
      $unionWith: {
        coll: "auditlogs",
        pipeline: [
          { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), requestId } },
          {
            $project: {
              type: { $literal: "AuditLog" },
              id: "$_id",
              level: 1,
              message: 1,
              meta: 1,
              createdAt: "$timestamp",
            },
          },
        ],
      },
    },

    // 🔹 Sort everything chronologically
    { $sort: { createdAt: 1 } },
  ];

  const db = mongoose.connection.db;
  const timeline = await db.collection("transactions").aggregate(pipeline).toArray();

  return { requestId, tenantId, timeline };
};
