// routes/momoRoutes.js
"use strict";

const express = require("express");
const router = express.Router();

const { initiateDeposit } = require("../modules/integrations/momo.service");
const { handleMomoCallback } = require("../modules/integrations/momo.webhook");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const logger = require("../utils/logger") || console;

// ✅ Tenant middleware for internal routes
router.use(tenantMiddleware);

/**
 * Initiate Deposit
 * - Requires tenant context
 * - Validates phone and amount
 */
router.post("/deposit", async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Phone and positive amount required" });
    }

    const result = await initiateDeposit({
      tenantId: req.tenantId,
      phone,
      amount,
    });

    logger.info("[MoMoRoutes] Deposit initiated", {
      tenantId: req.tenantId,
      phone,
      amount,
      reference: result.reference,
    });

    return res.json({
      message: "Deposit initiated",
      reference: result.reference,
    });
  } catch (error) {
    logger.error("[MoMoRoutes] Deposit error", {
      tenantId: req.tenantId,
      body: req.body,
      error: error.message,
    });
    return res.status(500).json({ error: "Deposit failed" });
  }
});

/**
 * Webhook (external call, no tenant middleware)
 * - Processes MTN MoMo callbacks
 */
router.post("/webhook", handleMomoCallback);

module.exports = router;
