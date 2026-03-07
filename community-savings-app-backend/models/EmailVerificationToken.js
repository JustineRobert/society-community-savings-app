const mongoose = require('mongoose');

const EmailVerificationTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  requestIp: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('EmailVerificationToken', EmailVerificationTokenSchema);
