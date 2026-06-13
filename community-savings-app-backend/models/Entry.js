// server/models/Entry.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const EntrySchema = new Schema({
  _id: { type: String, default: () => require('uuid').v4() },
  transactionId: { type: String, required: true, ref: 'LedgerTransaction' },
  accountId: { type: String, required: true, ref: 'Account' },
  amount: { type: Number, required: true, min: 0 }, // integer smallest unit
  direction: { type: String, required: true, enum: ['debit','credit'] },
  createdAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed, default: {} }
});

EntrySchema.index({ transactionId: 1 });
EntrySchema.index({ accountId: 1 });

module.exports = mongoose.model('Entry', EntrySchema);
