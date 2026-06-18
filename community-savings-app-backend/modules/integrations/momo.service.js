// services/momo.service.js
"use strict";

const axios = require("axios");
const crypto = require("crypto");
const logger = require("../utils/logger") || console;

const MOMO_BASE_URL = process.env.MOMO_BASE_URL;
const MOMO_API_KEY = process.env.MOMO_API_KEY;
const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_TOKEN = process.env.MTN_TOKEN; // ensure you fetch/refresh this securely

/**
 * Initiate Withdrawal (Disbursement)
 * - Generates unique reference ID
 * - Calls MTN MoMo Disbursement API
 * - Logs errors with context
 *
 * @param {Object} params
 * @param {String} params.tenantId - Tenant identifier
 * @param {String} params.phone - MSISDN phone number
 * @param {Number|String} params.amount - Transaction amount
 * @returns {Promise<Object>} - { reference }
 */
async function initiateWithdraw({ tenantId, phone, amount }) {
  if (!tenantId) throw new Error("TenantId is required");
  if (!phone) throw new Error("Phone number is required");
  if (!amount || Number(amount) <= 0) throw new Error("Amount must be positive");

  const reference = crypto.randomUUID();

  const payload = {
    amount,
    currency: "UGX",
    externalId: reference,
    payee: {
      partyIdType: "MSISDN",
      partyId: phone,
    },
    payerMessage: "Withdrawal request",
    payeeNote: `Tenant ${tenantId} withdrawal`,
  };

  try {
    await axios.post(`${MOMO_BASE_URL}/disbursement/v1_0/transfer`, payload, {
      headers: {
        Authorization: `Bearer ${MOMO_TOKEN}`,
        "X-Reference-Id": reference,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": MOMO_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    logger.info("[MoMoService] Withdrawal initiated", {
      tenantId,
      phone,
      amount,
      reference,
    });

    return { reference };
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    logger.error("[MoMoService] Withdrawal error", {
      tenantId,
      phone,
      amount,
      reference,
      error: errMsg,
    });
    throw new Error(`MoMo withdrawal failed: ${errMsg}`);
  }
}

module.exports = {
  initiateWithdraw,
};
