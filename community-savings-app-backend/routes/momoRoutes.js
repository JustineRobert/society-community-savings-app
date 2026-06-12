// Routes (routes/momoRoutes.js)

const express = require("express");
const router = express.Router();

const { requestToPay } = require("../controllers/momoCollectionController");
const { disburse } = require("../controllers/momoDisbursementController");
const { momoCallback } = require("../controllers/momoWebhookController");

router.post("/deposit", requestToPay);
router.post("/withdraw", disburse);
router.post("/webhook", momoCallback);

module.exports = router;
