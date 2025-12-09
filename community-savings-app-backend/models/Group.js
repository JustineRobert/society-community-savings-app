const mongoose = require('mongoose');

/**
 * Group Schema
 * Represents savings groups with members
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
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Group creator is required'],
    index: true,
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

module.exports = mongoose.model('Group', groupSchema);
