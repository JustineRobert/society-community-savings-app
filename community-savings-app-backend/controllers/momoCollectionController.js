// controllers/momoCollectionController.js
// Request-to-Pay (deposit / collection) controller for MTN MoMo
// - Generates X-Reference-Id (UUID)
// - Sends POST to /collection/v1_0/requesttopay
// - Persists a PENDING Transaction record for later reconciliation
// - Returns referenceId and initial status to caller

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const Transaction = require("../models/Transaction");

/**
 * POST /collection/requesttopay
 * Body: { amount: "10000", phone: "2567XXXXXXXX", externalId?: "..." }
 */
exports.requestToPay = async (req, res) => {
  try {
    // Basic validation
    const { amount, phone } = req.body;
    if (!amount || !phone) {
      return res.status(400).json({ error: "Missing required fields: amount, phone" });
    }

    // Generate reference id for idempotency / tracking
    const referenceId = uuidv4();

    // Build request body for MTN MoMo Collection API
    const body = {
      amount: String(amount),
      currency: process.env.MOMO_CURRENCY || "UGX",
      externalId: referenceId,
      payer: {
        partyIdType: "MSISDN",
        partyId: phone,
      },
      payerMessage: req.body.payerMessage || "SACCO Deposit",
      payeeNote: req.body.payeeNote || "Community Savings",
    };

    // Resolve bearer token (expected to be set by auth middleware as req.token)
    const token = req.token || process.env.MOMO_BEARER_TOKEN;
    if (!token) {
      return res.status(401).json({ error: "Missing MoMo bearer token. Ensure auth middleware sets req.token or set MOMO_BEARER_TOKEN." });
    }

    // Prepare headers
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": process.env.MOMO_ENV || "sandbox",
      "Ocp-Apim-Subscription-Key": process.env.COLLECTION_KEY,
      "Content-Type": "application/json",
    };

    // Persist initial transaction record (PENDING)
    const tx = await Transaction.create({
      externalId: referenceId,
      amount: Number(amount),
      currency: body.currency,
      phone,
      flow: "credit", // deposit -> credit to user's wallet
      provider: "mtn_momo",
      status: "PENDING",
      metadata: {
        requestBody: body,
      },
      createdAt: new Date(),
    });

    // Send request to MTN MoMo Collection API
    const url = `${process.env.MOMO_BASE_URL.replace(/\/$/, "")}/collection/v1_0/requesttopay`;

    // Fire the request but keep the API response handling simple:
    // MTN typically returns 202 Accepted with no body; the provider will call webhook later.
    await axios.post(url, body, { headers, timeout: 15000 });

    // Return the reference to the caller for tracking
    return res.status(202).json({
      referenceId,
      status: tx.status,
      message: "Request to Pay initiated. Await webhook callback for final status.",
    });
  } catch (err) {
    console.error("requestToPay error:", err && err.response ? err.response.data || err.response.statusText : err.message);

    // Attempt to mark transaction as FAILED if it was created
    try {
      if (typeof referenceId !== "undefined") {
        await Transaction.updateOne(
          { externalId: referenceId },
          {
            status: "FAILED",
            "metadata.requestError": err && err.response ? err.response.data : err.message,
            updatedAt: new Date(),
          }
        );
      }
    } catch (uErr) {
      console.error("Failed to update transaction after requestToPay error:", uErr);
    }

    return res.status(500).json({ error: "Failed to initiate RequestToPay", details: err && err.response ? err.response.data : err.message });
  }
};
