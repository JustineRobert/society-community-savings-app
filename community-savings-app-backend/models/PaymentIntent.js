const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema(
  {
    intentId: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'KES' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
      default: 'pending',
    },
    provider: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, index: true },
    attempts: { type: Number, default: 0 },
    clientData: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentIntent', PaymentIntentSchema);
