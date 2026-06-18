// routes/auditRoutes.js
const express = require("express");
const router = express.Router();
const auditService = require("../services/auditService");

/**
 * GET /audit/timeline/:requestId
 * Retrieve unified transaction timeline (Transaction + LedgerEntry + AuditLog)
 */
router.get("/audit/timeline/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { tenantId } = req.query; // 🔹 Pass tenantId as query param for multi-tenant safety

    if (!tenantId || !requestId) {
      return res.status(400).json({ error: "tenantId and requestId are required" });
    }

    const timeline = await auditService.getUnifiedTimeline(tenantId, requestId);

    res.status(200).json(timeline);
  } catch (err) {
    console.error("Error fetching audit timeline:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
