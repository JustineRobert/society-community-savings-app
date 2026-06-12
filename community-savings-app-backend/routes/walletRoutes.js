//Routes (routes/walletRoutes.js)
const express = require("express");
const router = express.Router();
const { getBalance } = require("../controllers/walletController");

router.get("/balance", getBalance);

module.exports = router;

