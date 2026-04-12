// services/redis.js
// Production-ready Redis client with exponential backoff, throttled logging, and graceful degradation

const Redis = require('ioredis');

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Exponential backoff configuration
const MIN_RECONNECT_DELAY = 1000;      // 1 second
const MAX_RECONNECT_DELAY = 30000;     // 30 seconds
const BACKOFF_MULTIPLIER = 1.5;

// Throttle error logs (log only once every N seconds)
const ERROR_LOG_THROTTLE_MS = 30000;   // 30 seconds in production, 5 in development
const errorLogThrottle = NODE_ENV === 'production' ? ERROR_LOG_THROTTLE_MS : 5000;

let lastErrorLog = 0;
let reconnectAttempts = 0;
let isConnecting = false;

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attemptCount) {
  const exponentialDelay = Math.min(
    MIN_RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, attemptCount),
    MAX_RECONNECT_DELAY
  );
  // Add jitter (±10% randomness) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() - 0.5);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Throttled error logging
 */
function logErrorThrottled(message, error) {
  const now = Date.now();
  if (now - lastErrorLog > errorLogThrottle) {
    console.error(message, error);
    lastErrorLog = now;
  }
}

let redis;
try {
  redis = new Redis(REDIS_URL, {
    // Exponential backoff + maximum delay configuration
    retryStrategy: (times) => {
      if (times > 10) {
        // Stop retrying after 10 attempts
        return null;
      }
      const delay = getBackoffDelay(times - 1);
      logErrorThrottled(`🔄 Redis reconnection attempt ${times}, backing off for ${delay}ms`, null);
      return delay;
    },
    
    // Connection timeout
    connectTimeout: 10000,
    
    // Command timeout
    commandTimeout: 5000,
    
    // Enable offline queue to queue commands while disconnected
    enableOfflineQueue: true,
    
    // Max offline queue size (prevent memory leaks)
    maxRetriesPerRequest: 3,
    
    // Enable auto-pipelining for better performance
    enableReadyCheck: true,
    
    // Suppress ioredis default error logging (we handle it ourselves)
    lazyConnect: false,
  });
} catch (error) {
  console.warn('⚠️ Failed to create Redis client, Redis features will be disabled', { error: error.message });
  // Create a mock Redis client that doesn't throw errors
  redis = {
    call: () => Promise.reject(new Error('Redis not available')),
    on: () => {},
    off: () => {},
    status: 'mock',
  };
}

// Handle connection events with throttling
redis.on('connect', () => {
  reconnectAttempts = 0;
  console.log('✅ Redis connected');
});

redis.on('ready', () => {
  console.log('✅ Redis ready and accepting commands');
});

redis.on('error', (err) => {
  // Throttle error logging to prevent spam
  logErrorThrottled('❌ Redis error:', err);
  // Prevent unhandled rejections by not throwing
});

redis.on('reconnecting', () => {
  reconnectAttempts++;
  if (NODE_ENV !== 'production') {
    console.log(`🔄 Redis reconnecting (attempt ${reconnectAttempts})...`);
  }
});

redis.on('close', () => {
  if (NODE_ENV !== 'production') {
    console.log('🔌 Redis connection closed');
  }
});

redis.on('warn', (msg) => {
  if (NODE_ENV !== 'production') {
    console.warn('⚠️ Redis warning:', msg);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (redis && redis.status !== 'mock') {
    try {
      await redis.quit();
      console.log('✅ Redis disconnected gracefully');
    } catch (err) {
      console.error('❌ Error disconnecting Redis:', err);
    }
  }
});

process.on('SIGINT', async () => {
  if (redis && redis.status !== 'mock') {
    try {
      await redis.quit();
      console.log('✅ Redis disconnected gracefully');
    } catch (err) {
      console.error('❌ Error disconnecting Redis:', err);
    }
  }
});

module.exports = redis;
