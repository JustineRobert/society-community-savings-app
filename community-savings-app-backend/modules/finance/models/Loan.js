// backend/modules/finance/models/Loan.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const LOAN_STATUS = ['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DEFAULTED'];

const LoanSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    memberId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    principal: {
      type: Schema.Types.Decimal128,
      required: true,
      get: v => (v ? parseFloat(v.toString()) : 0),
      set: v => mongoose.Types.Decimal128.fromString(Number(v).toFixed(2))
    },

    interestRate: { type: Number, required: true }, // % per period

    termMonths: { type: Number, required: true },

    balance: {
      type: Schema.Types.Decimal128,
      default: mongoose.Types.Decimal128.fromString('0.00'),
      get: v => (v ? parseFloat(v.toString()) : 0),
      set: v => mongoose.Types.Decimal128.fromString(Number(v).toFixed(2))
    },

    status: {
      type: String,
      enum: LOAN_STATUS,
      default: 'PENDING',
      index: true
    },

    approvedAt: Date,
    disbursedAt: Date,

    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

module.exports = mongoose.model('Loan', LoanSchema);