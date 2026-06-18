// routes/authRoutes.js
"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

/**
 * GET /auth/test-token
 * Generate a short-lived JWT for testing RBAC flows
 * Query params: role, tenantId, userId
 */
router.get("/auth/test-token", (req, res) => {
  const { role = "AUDITOR", tenantId = "64b1234567890abcdef12345", userId = "test-user" } = req.query;

  // Payload with role claim
  const payload = {
    id: userId,
    tenantId,
    role,
  };

  // Short-lived token (e.g., 5 minutes)
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "5m" });

  res.json({
    success: true,
    role,
    token,
    expiresIn: "5m",
    payload,
  });
});

module.exports = router;
