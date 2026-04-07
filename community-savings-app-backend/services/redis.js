// services/redis.js
// wrapper for Redis connection used across the backend services

const Redis = require('ioredis');

// allow configuration via REDIS_URL env var (Docker/Compose uses redis://redis:6379)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (error) {
  console.warn('⚠️ Failed to create Redis client, Redis features will be disabled', { error: error.message });
  // Create a mock Redis client that doesn't throw errors
  redis = {
    call: () => Promise.reject(new Error('Redis not available')),
    on: () => {},
    status: 'mock',
  };
}

redis.on('connect', () => {
  console.log('🔌 Connected to Redis');
});
redis.on('error', (err) => {
  console.error('Redis error:', err);
  // Prevent unhandled rejections by not throwing
});
redis.on('ready', () => {
  console.log('🔌 Redis ready');
});
redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

module.exports = redis;
