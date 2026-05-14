const mongoose = require('mongoose');

/**
 * Group Schema - Enhanced with roles, description, and audit logging
 * Represents savings groups with member roles and detailed tracking
 */
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    minlength: [3, 'Group name must be at least 3 characters'],
    maxlength: [100, 'Group name must be less than 100 characters'],
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['savings', 'investment', 'community', 'welfare'],
    default: 'savings',
    required: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description must be less than 500 characters'],
    default: '',
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  memberRoles: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'treasurer', 'secretary'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Group creator is required'],
    index: true,
  },
  metadata: {
    totalInvited: {
      type: Number,
      default: 0,
    },
    invitationsSent: {
      type: Number,
      default: 0,
    },
    lastInvitationBatch: {
      type: Date,
    },
    auditLog: [{
      action: {
        type: String,
        enum: ['created', 'member_added', 'member_removed', 'invitation_sent', 'invitation_accepted'],
      },
      userId: mongoose.Schema.Types.ObjectId,
      timestamp: {
        type: Date,
        default: Date.now,
      },
      details: mongoose.Schema.Types.Mixed,
    }]
  }
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

// Index for group listing by creator
groupSchema.index({ createdBy: 1, createdAt: -1 });

// Index for group type filtering
groupSchema.index({ type: 1 });

module.exports = mongoose.model('Group', groupSchema);
