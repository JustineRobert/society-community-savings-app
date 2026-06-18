// services/momoService.js
const httpClient = require("../utils/httpClient");
const logger = require("../utils/logger");

/**
 * Initiate a MoMo payment request
 *
 * @param {Object} params
 * @param {Number} params.amount - Transaction amount
 * @param {String} params.phoneNumber - MSISDN of payer
 * @param {String} params.requestId - Correlation ID for tracing
 */
exports.initiatePayment = async ({ amount, phoneNumber, requestId }) => {
  try {
    const response = await httpClient.post(
      "https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay",
      {
        amount,
        currency: "UGX",
        externalId: `txn-${Date.now()}`,
        payer: { partyIdType: "MSISDN", partyId: phoneNumber },
        payerMessage: "Wallet deposit",
        payeeNote: "SACCO deposit",
      },
      {
        requestId, // 🔹 Pass requestId into config
        headers: {
          "X-Request-Id": requestId, // 🔹 Explicitly propagate correlation ID
          Authorization: `Bearer ${process.env.MTN_TOKEN}`,
          "X-Target-Environment": process.env.MTN_ENV || "sandbox",
          "Ocp-Apim-Subscription-Key": process.env.MTN_SUB_KEY,
        },
      }
    );

    logger.info("MoMo payment initiated", { requestId, amount, phoneNumber });
    return response.data;
  } catch (err) {
    logger.error("MoMo payment failed", { requestId, error: err.message });
    throw err;
  }
};
