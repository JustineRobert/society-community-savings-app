// controllers/groupController.js

const Group = require('../models/Group');
const logger = require('../utils/logger');

/**
 * Create a new group and add the current user as the initial member and creator.
 */
exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !req.user || !req.user.id) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    const group = new Group({
      name,
      description: description || '',
      members: [req.user.id],
      createdBy: req.user.id,
    });

    await group.save();
    
    logger.info(`Group created: ${group._id} by user ${req.user.id}`);
    
    res.status(201).json({
      message: 'Group created successfully',
      data: group,
    });
  } catch (err) {
    logger.error('Error creating group:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to create group',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Join an existing group by ID, if not already a member.
 */
exports.joinGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Prevent duplicate membership
    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    group.members.push(req.user.id);
    await group.save();

    logger.info(`User ${req.user.id} joined group ${groupId}`);

    res.json({
      message: 'Successfully joined group',
      data: group,
    });
  } catch (err) {
    logger.error('Error joining group:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to join group',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Retrieve all groups where the current user is a member.
 */
exports.getGroups = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const groups = await Group.find({ members: req.user.id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Group.countDocuments({ members: req.user.id });

    res.json({
      message: 'Groups retrieved successfully',
      data: groups,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching groups:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to fetch groups',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Get a specific group by ID with member details
 */
exports.getGroupById = async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(member => member._id.equals(req.user.id))) {
      return res.status(403).json({ message: 'Not authorized to view this group' });
    }

    res.json({
      message: 'Group retrieved successfully',
      data: group,
    });
  } catch (err) {
    logger.error('Error fetching group:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to fetch group',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};

/**
 * Leave a group (remove user from members)
 */
exports.leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Prevent group creator from leaving
    if (group.createdBy.equals(req.user.id)) {
      return res.status(403).json({ message: 'Group creator cannot leave the group' });
    }

    group.members = group.members.filter(memberId => !memberId.equals(req.user.id));
    await group.save();

    logger.info(`User ${req.user.id} left group ${groupId}`);

    res.json({
      message: 'Successfully left the group',
      data: group,
    });
  } catch (err) {
    logger.error('Error leaving group:', { userId: req.user.id, error: err.message });
    res.status(500).json({ 
      message: 'Failed to leave group',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};
