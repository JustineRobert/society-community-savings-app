const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'UGX' },
  type: { type: String, enum: ['credit','debit'], required: true },
  reference: { type: String },
  source: { type: String },
  status: { type: String, enum: ['pending','completed','failed'], default: 'pending' },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
