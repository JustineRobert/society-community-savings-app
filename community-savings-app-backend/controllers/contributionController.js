// controllers/contributionController.js

const Contribution = require('../models/Contribution');
const Group = require('../models/Group');
const logger = require('../utils/logger');

/**
 * Add a contribution to a group
 */
exports.addContribution = async (req, res) => {
  try {
    const { groupId, amount } = req.body;

    if (!groupId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid groupId or amount' });
    }

    // Verify user is a member of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const contribution = new Contribution({
      user: req.user.id,
      group: groupId,
      amount,
    });

    await contribution.save();

    logger.info(`Contribution added: ${amount} by user ${req.user.id} to group ${groupId}`);

    res.status(201).json({
      message: 'Contribution added successfully',
      data: contribution,
    });
  } catch (err) {
    logger.error('Error adding contribution:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to add contribution',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Get all contributions for a group
 */
exports.getGroupContributions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const contributions = await Contribution.find({ group: groupId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contribution.countDocuments({ group: groupId });

    res.json({
      message: 'Group contributions retrieved successfully',
      data: contributions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching group contributions:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to fetch contributions',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Get all contributions by the current user
 */
exports.getUserContributions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const contributions = await Contribution.find({ user: req.user.id })
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contribution.countDocuments({ user: req.user.id });

    res.json({
      message: 'User contributions retrieved successfully',
      data: contributions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching user contributions:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to fetch contributions',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Get contribution statistics for a group
 */
exports.getGroupStats = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const stats = await Contribution.aggregate([
      { $match: { group: require('mongoose').Types.ObjectId(groupId) } },
      {
        $group: {
          _id: '$group',
          totalAmount: { $sum: '$amount' },
          contributionCount: { $sum: 1 },
          avgContribution: { $avg: '$amount' },
        }
      }
    ]);

    res.json({
      message: 'Group statistics retrieved successfully',
      data: stats[0] || { totalAmount: 0, contributionCount: 0, avgContribution: 0 },
    });
  } catch (err) {
    logger.error('Error fetching group stats:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};
