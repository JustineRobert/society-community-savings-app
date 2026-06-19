// services/notificationService.js
'use strict';

const mongoose = require('mongoose');
const User = require('../models/User'); // adjust if your user model is named differently

/**
 * Send a notification to a list of recipients
 * @param {Array<mongoose.Types.ObjectId>} recipients - User IDs
 * @param {String} title - Notification title
 * @param {Object} payload - Extra metadata (e.g. { conversationId })
 */
async function send(recipients, title, payload = {}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    console.warn('[NotificationService] No recipients provided');
    return;
  }

  try {
    // Example: persist notifications in DB
    const NotificationModel = mongoose.model(
      'Notification',
      new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true },
        payload: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
      }, { collection: 'notifications' })
    );

    const docs = recipients.map(r => ({
      userId: r,
      title,
      payload,
    }));

    await NotificationModel.insertMany(docs);

    console.info(`[NotificationService] Sent "${title}" to ${recipients.length} users`);
  } catch (err) {
    console.error('[NotificationService] Failed to send notification', {
      title,
      recipients,
      error: err.message,
    });
    throw err;
  }
}

module.exports = { send };
