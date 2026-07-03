// services/kyc.service.js
"use strict";

const axios = require("axios");
const logger = require("../../utils/logger") || console;

const BASE_URL = process.env.KYC_PROVIDER_URL;
const API_KEY = process.env.KYC_API_KEY;

/**
 * Verify National ID (KYC)
 * - Validates required fields
 * - Calls external KYC provider
 * - Normalizes responses and errors
 *
 * @param {Object} params
 * @param {String} params.firstName - User's first name
 * @param {String} params.lastName - User's last name
 * @param {String} params.nin - National ID number
 * @returns {Promise<Object>} - Normalized verification result
 */
async function verifyIdentity({ firstName, lastName, nin }) {
  try {
    // ✅ Input validation
    if (!firstName || !lastName || !nin) {
      throw new Error("Missing required identity fields");
    }

    const response = await axios.post(
      `${BASE_URL}/verify`,
      {
        firstName,
        lastName,
        idNumber: nin,
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data) {
      throw new Error("Empty response from KYC provider");
    }

    logger.info("[KYCService] Verification successful", {
      nin,
      firstName,
      lastName,
      status: response.data.status,
      matchScore: response.data.matchScore || 0,
    });

    return {
      status: response.data.status,
      matchScore: response.data.matchScore || 0,
    };
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;

    logger.error("[KYCService] Verification failed", {
      nin,
      firstName,
      lastName,
      error: errMsg,
    });

    // ✅ Normalize errors
    if (error.response) {
      return {
        status: "failed",
        reason: errMsg || "Verification failed",
      };
    }

    if (error.code === "ECONNABORTED") {
      return {
        status: "failed",
        reason: "KYC provider timeout",
      };
    }

    return {
      status: "failed",
      reason: errMsg,
    };
  }
}

module.exports = {
  verifyIdentity,
};
