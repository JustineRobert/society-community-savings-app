/models/IdempotencyKey.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const IdempotencyKeySchema = new Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed, default: {} }
});

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
