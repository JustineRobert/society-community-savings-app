// models/AuditLog.js
const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  actorId: { type: String, required: true },
  saccoId: { type: String, required: true },
  endpoint: { type: String },
  payload: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
