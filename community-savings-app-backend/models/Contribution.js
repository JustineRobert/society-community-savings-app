const mongoose = require('mongoose');

/**
 * Contribution Schema
 * Records individual contributions to group savings
 */
const contributionSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group ID is required'],
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Contribution amount is required'],
    min: [0, 'Amount must be positive'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = doc._id.toString();
      delete ret._id;
    },
  },
  toObject: { virtuals: true }
});

// Compound index for faster queries
contributionSchema.index({ groupId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('Contribution', contributionSchema);
