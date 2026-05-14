// services/queue.js
// centralized Bull queues for background jobs

const Queue = require('bull');
const redis = require('./redis');

// example notification queue
const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL || 'redis://localhost:6379';
const notificationQueue = new Queue('notifications', {
  redis: { url: redisUrl },
});

// process jobs and emit via socket.io
notificationQueue.process(async (job) => {
  const { io } = require('../server');
  let payload = job.data;
  // enrich with a human-friendly message if not provided
  if (!payload.message) {
    switch (payload.type) {
      case 'group-created':
        payload.message = `A new group "${payload.name}" was created.`;
        break;
      case 'group-joined':
        payload.message = `User joined group ${payload.groupId}`;
        break;
      default:
        payload.message = 'You have a notification';
    }
  }
  console.log('Processing notification job', payload);
  if (io) {
    io.emit('notification', payload);
  }
  return Promise.resolve();
});

module.exports = {
  notificationQueue,
};
