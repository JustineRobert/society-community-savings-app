const mongoose = require('mongoose');

// Sub-schema for loan installments
const InstallmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Installment amount is required'],
    min: [1, 'Installment amount must be greater than zero']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  }
}, { _id: false });

// Sub-schema for notifications
const NotificationSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    maxlength: [500, 'Notification message must be less than 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Main Loan schema
const LoanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group reference is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [1, 'Loan amount must be greater than zero']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'repaid'],
    default: 'pending',
    lowercase: true,
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  interestRate: {
    type: Number,
    default: 0
  },
  repaymentPeriodMonths: {
    type: Number,
    default: 6,
    min: [1, 'Repayment period must be at least 1 month']
  },
  repaymentDate: {
    type: Date
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [300, 'Reason must be less than 300 characters']
  },
  installments: [InstallmentSchema],
  notifications: [NotificationSchema],
  eligibilityScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = doc._id.toString();
      delete ret._id;
    }
  },
  toObject: { virtuals: true }
});

// Compound index for analytics
LoanSchema.index({ group: 1, status: 1, createdAt: -1 });

/**
 * Static method to calculate eligibility score
 * You can customize this further based on actual Contribution or LoanRepayment data
 */
LoanSchema.statics.calculateEligibility = async function (userId, groupId) {
  const Contribution = mongoose.model('Contribution');
  const contributions = await Contribution.find({ user: userId, group: groupId });
  const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);

  let score = 0;
  if (totalContributions >= 1000) score += 50;
  if (contributions.length >= 6) score += 30;

  return Math.min(score, 100);
};

/**
 * Instance method to update repayment status
 */
LoanSchema.methods.updateRepaymentStatus = async function () {
  const allPaid = this.installments.length > 0 && this.installments.every(i => i.paid === true);

  if (allPaid && this.status !== 'repaid') {
    this.status = 'repaid';
    this.notifications.push({
      message: 'Loan fully repaid. Status updated to "repaid".'
    });
    await this.save();
  }
};

/**
 * Middleware: push notification on loan status change
 */
LoanSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.notifications.push({
      message: `Loan status changed to "${this.status}".`
    });
  }
  next();
});

module.exports = mongoose.model('Loan', LoanSchema);
