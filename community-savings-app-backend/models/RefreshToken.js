const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  deviceInfo: {
    ip: String,
    ua: String,
    name: String,
    deviceId: String,
  },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, default: null },
  replacedBy: { type: String, default: null },
});

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
