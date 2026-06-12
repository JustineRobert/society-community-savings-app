"use strict";

const express = require("express");
const router = express.Router();

// Controllers
const contributionsController = require("../controllers/contributionsController");
const loansController = require("../controllers/loansController");
const repaymentsController = require("../controllers/repaymentsController");
const walletsController = require("../controllers/groupWalletController");

// Middleware
const { authenticate } = require("../middleware/auth");

// Utility: async error wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * ============================================
 * API ROUTES (v1)
 * ============================================
 * Central registry for all application routes
 * Keeps server.js clean and scalable.
 */

const API_PREFIX = "/api/v1";

/**
 * CONTRIBUTIONS
 */
router.post(
  `${API_PREFIX}/contributions`,
  authenticate,
  asyncHandler(contributionsController.createContribution)
);

/**
 * LOANS
 */
router.post(
  `${API_PREFIX}/loans`,
  authenticate,
  asyncHandler(loansController.createLoan)
);

/**
 * LOAN REPAYMENTS
 */
router.post(
  `${API_PREFIX}/repayments`,
  authenticate,
  asyncHandler(repaymentsController.createRepayment)
);

/**
 * GROUP WALLETS
 */
router.get(
  `${API_PREFIX}/group-wallets/:id/balance`,
  authenticate,
  asyncHandler(walletsController.getBalance)
);

router.get(
  `${API_PREFIX}/group-wallets/:id/ledger`,
  authenticate,
  asyncHandler(walletsController.getLedger)
);

/**
 * HEALTH CHECK (for monitoring)
 */
router.get(`${API_PREFIX}/health`, (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "TITech Ledger API",
    timestamp: new Date().toISOString(),
  });
});

/**
 * FALLBACK 404 HANDLER
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = router;
