// routes/transaction.routes.js

const express = require("express");
const router = express.Router();
const controller = require("../controllers/transaction.controller");
const auth = require("../middlewares/auth");

// Protected routes
router.post("/deposit", auth, controller.deposit);
router.post("/withdraw", auth, controller.withdraw);

// Webhook (public)
router.post("/momo/webhook", controller.momoWebhook);

module.exports = router;